import { validateCardCatalog } from "../catalog/create-card-catalog.js";
import { validateGameRules } from "../catalog/validate-game-rules.js";
import { validateDeck } from "../deck/validate-deck.js";
import { nextRandomValue, shuffle } from "../random/shuffle.js";
import type {
  CardDefinition,
  CardCatalog,
} from "../contracts/card-definition.js";
import type { DeepReadonly } from "../contracts/deep-readonly.js";
import type {
  InitializeGameError,
  InitializeGameInput,
  InitializeGameResult,
} from "../contracts/commands.js";
import type { GameEngineContext } from "../contracts/engine.js";
import type { DomainEvent } from "../contracts/events.js";
import type {
  CardInstance,
  GameEngineDependencies,
  GameState,
  ManaState,
  PlayerState,
  RandomSequence,
} from "../contracts/game-state.js";
import type { CardInstanceId, PlayerId } from "../contracts/identifiers.js";

export const MAX_INITIAL_HAND_ATTEMPTS = 20;

export function initializeGame(
  input: InitializeGameInput,
  context: GameEngineContext,
  dependencies: GameEngineDependencies,
): InitializeGameResult {
  const inputError = validateInitializeInput(input);
  if (inputError !== null) {
    return { initialized: false, error: inputError };
  }

  const rulesResult = validateGameRules(context.rules);
  if (!rulesResult.valid) {
    return {
      initialized: false,
      error: {
        code: "CARD_CATALOG_INVALID",
        message: "ゲームルールが初期化条件を満たしていません。",
      },
    };
  }

  const catalogResult = validateCardCatalog(context.cardCatalog, context);
  if (!catalogResult.valid) {
    return {
      initialized: false,
      error: {
        code: "CARD_CATALOG_INVALID",
        message: "カードカタログが初期化条件を満たしていません。",
      },
    };
  }

  const deckResults = input.players.map((player) => ({
    playerId: player.playerId,
    result: validateDeck(
      player.deckDefinitionIds,
      context.cardCatalog,
      context.rules,
    ),
  }));
  const invalidDeck = deckResults.find((entry) => !entry.result.valid);
  if (invalidDeck !== undefined) {
    return {
      initialized: false,
      error: {
        code: "DECK_VALIDATION_FAILED",
        message: `プレイヤー ${invalidDeck.playerId} のデッキが条件を満たしていません。`,
        details: { playerId: invalidDeck.playerId },
      },
    };
  }

  try {
    const startedAt = validateClockValue(dependencies.clock.now());
    const random = dependencies.random.create(input.randomSeed);
    const createdCards = createCardInstances(
      input,
      dependencies,
      context.cardCatalog,
    );
    const initializedPlayers = createInitialPlayerStates(
      input,
      createdCards.cardInstances,
      createdCards.deckCardIdsByPlayer,
      context.cardCatalog,
      context,
      random,
    );
    const firstPlayerId =
      nextRandomValue(random) < 0.5
        ? input.players[0].playerId
        : input.players[1].playerId;
    const secondPlayerId =
      firstPlayerId === input.players[0].playerId
        ? input.players[1].playerId
        : input.players[0].playerId;
    const phaseDeadlineAt = startedAt + context.rules.placementTimeLimitMs;
    const events = createInitialEvents(
      input.players.map((player) => player.playerId),
      initializedPlayers.players,
      initializedPlayers.initialDrawnCardIds,
      firstPlayerId,
      secondPlayerId,
      phaseDeadlineAt,
    );
    const stateVersion = 1;
    const state: GameState = {
      gameId: input.gameId,
      initialRandomSeed: input.randomSeed,
      rulesetVersion: context.rules.version,
      cardCatalogVersion: context.cardCatalog.version,
      engineSemanticsVersion: context.engineSemanticsVersion,
      stateVersion,
      status: "active",
      round: 1,
      phase: "firstPlayerPlacement",
      phaseSequence: 1,
      phaseStartedAt: startedAt,
      phaseDeadlineAt,
      playerOrder: [input.players[0].playerId, input.players[1].playerId],
      firstPlayerId,
      secondPlayerId,
      players: initializedPlayers.players,
      cardInstances: createdCards.cardInstances,
      activeEffects: [],
      supportFinishedBy: [],
      lastRoundResult: null,
      winner: null,
      processedCommandIds: [],
      nextEffectSequence: 1,
      nextEventSequence: events.length + 1,
    };

    return {
      initialized: true,
      state,
      events: events.map((event, index) => ({
        sequence: index + 1,
        stateVersion,
        occurredAt: startedAt,
        event,
      })),
    };
  } catch (error) {
    if (error instanceof InitialHandSelectionError) {
      return {
        initialized: false,
        error: {
          code: "INITIAL_HAND_SELECTION_FAILED",
          message: error.message,
        },
      };
    }

    return {
      initialized: false,
      error: {
        code: "DEPENDENCY_OUTPUT_INVALID",
        message:
          error instanceof Error
            ? error.message
            : "ゲーム初期化の依存性が不正な値を返しました。",
      },
    };
  }
}

function validateInitializeInput(
  input: InitializeGameInput,
): InitializeGameError | null {
  if (!Array.isArray(input.players) || input.players.length !== 2) {
    return {
      code: "INVALID_PLAYER_COUNT",
      message: "ゲーム初期化には2人のプレイヤーが必要です。",
    };
  }
  if (input.players[0].playerId === input.players[1].playerId) {
    return {
      code: "DUPLICATE_PLAYER_ID",
      message: "プレイヤーIDは重複できません。",
    };
  }
  if (
    input.gameId.trim().length === 0 ||
    input.randomSeed.trim().length === 0
  ) {
    return {
      code: "DEPENDENCY_OUTPUT_INVALID",
      message: "ゲームIDと乱数seedは空文字列にできません。",
    };
  }
  return null;
}

function createCardInstances(
  input: InitializeGameInput,
  dependencies: GameEngineDependencies,
  catalog: CardCatalog,
): {
  cardInstances: Record<CardInstanceId, CardInstance>;
  deckCardIdsByPlayer: Record<PlayerId, CardInstanceId[]>;
} {
  const cardInstances: Record<CardInstanceId, CardInstance> =
    Object.create(null);
  const deckCardIdsByPlayer: Record<PlayerId, CardInstanceId[]> =
    Object.create(null);

  for (const player of input.players) {
    const playerDeckCardIds: CardInstanceId[] = [];
    deckCardIdsByPlayer[player.playerId] = playerDeckCardIds;
    for (const [index, definitionId] of player.deckDefinitionIds.entries()) {
      if (catalog.definitions[definitionId] === undefined) {
        throw new Error(`カード定義 ${definitionId} が見つかりません。`);
      }

      const instanceId = dependencies.idGenerator.generate({
        kind: "cardInstance",
        gameId: input.gameId,
        seed: `${input.randomSeed}:card:${player.playerId}:${index}`,
      });
      if (typeof instanceId !== "string" || instanceId.trim().length === 0) {
        throw new Error("ID生成器が空のカードインスタンスIDを返しました。");
      }
      if (cardInstances[instanceId] !== undefined) {
        throw new Error(
          `カードインスタンスID ${instanceId} が重複しています。`,
        );
      }

      cardInstances[instanceId] = {
        instanceId,
        definitionId,
        ownerId: player.playerId,
      };
      playerDeckCardIds.push(instanceId);
    }
  }

  return { cardInstances, deckCardIdsByPlayer };
}

function createInitialPlayerStates(
  input: InitializeGameInput,
  cardInstances: Record<CardInstanceId, CardInstance>,
  deckCardIdsByPlayer: Record<PlayerId, CardInstanceId[]>,
  catalog: CardCatalog,
  context: GameEngineContext,
  random: RandomSequence,
): {
  players: Record<PlayerId, PlayerState>;
  initialDrawnCardIds: Record<PlayerId, CardInstanceId[]>;
} {
  const players: Record<PlayerId, PlayerState> = Object.create(null);
  const initialDrawnCardIds: Record<PlayerId, CardInstanceId[]> =
    Object.create(null);

  for (const player of input.players) {
    const cardIds = deckCardIdsByPlayer[player.playerId];
    if (cardIds === undefined) {
      throw new Error("プレイヤーのカードインスタンスを取得できません。");
    }
    const shuffledDeck = shuffle(cardIds, random);
    const initialHand = drawInitialHand(
      shuffledDeck,
      context.rules.initialDrawCount,
      random,
      cardInstances,
      catalog,
    );
    const mana = createEmptyManaState();
    const discardPile: CardInstanceId[] = [];
    const hand: CardInstanceId[] = [];

    for (const cardInstanceId of initialHand.hand) {
      const definition = getCardDefinition(
        cardInstanceId,
        cardInstances,
        catalog,
      );
      if (definition.cardType === "mana") {
        mana[definition.attribute].total += definition.manaAmount;
        discardPile.push(cardInstanceId);
      } else {
        hand.push(cardInstanceId);
      }
    }

    initialDrawnCardIds[player.playerId] = initialHand.hand;

    players[player.playerId] = {
      playerId: player.playerId,
      stamina: context.rules.initialStamina,
      deck: initialHand.deck,
      hand,
      discardPile,
      battlefield: { attackGroups: [], supportZone: [] },
      mana,
    };
  }

  return { players, initialDrawnCardIds };
}

function drawInitialHand(
  initialDeck: readonly CardInstanceId[],
  drawCount: number,
  random: RandomSequence,
  cardInstances: Record<CardInstanceId, CardInstance>,
  catalog: CardCatalog,
): { deck: CardInstanceId[]; hand: CardInstanceId[] } {
  let deck = [...initialDeck];

  for (let attempt = 1; attempt <= MAX_INITIAL_HAND_ATTEMPTS; attempt += 1) {
    const hand = deck.slice(0, drawCount);
    const remainingDeck = deck.slice(drawCount);

    if (
      !hand.every(
        (cardInstanceId) =>
          getCardDefinition(cardInstanceId, cardInstances, catalog).cardType ===
          "mana",
      )
    ) {
      return { deck: remainingDeck, hand };
    }

    deck = shuffle([...hand, ...remainingDeck], random);
  }

  throw new InitialHandSelectionError("初期手札の引き直し上限に達しました。");
}

class InitialHandSelectionError extends Error {}

function createEmptyManaState(): ManaState {
  return {
    attributeA: { total: 0 },
    attributeB: { total: 0 },
    attributeC: { total: 0 },
  };
}

function getCardDefinition(
  cardInstanceId: CardInstanceId,
  cardInstances: Record<CardInstanceId, CardInstance>,
  catalog: CardCatalog,
): DeepReadonly<CardDefinition> {
  const cardInstance = cardInstances[cardInstanceId];
  if (cardInstance === undefined) {
    throw new Error(`カードインスタンス ${cardInstanceId} が見つかりません。`);
  }
  const definition = catalog.definitions[cardInstance.definitionId];
  if (definition === undefined) {
    throw new Error(
      `カード定義 ${cardInstance.definitionId} が見つかりません。`,
    );
  }
  return definition;
}

function createInitialEvents(
  playerIds: readonly PlayerId[],
  players: Record<PlayerId, PlayerState>,
  initialDrawnCardIds: Record<PlayerId, CardInstanceId[]>,
  firstPlayerId: PlayerId,
  secondPlayerId: PlayerId,
  phaseDeadlineAt: number,
): DomainEvent[] {
  const events: DomainEvent[] = [];

  for (const playerId of playerIds) {
    const player = players[playerId];
    const drawnCardIds = initialDrawnCardIds[playerId];
    if (player === undefined || drawnCardIds === undefined) {
      throw new Error("初期プレイヤー状態を取得できません。");
    }
    events.push({
      type: "CARDS_DRAWN",
      playerId: player.playerId,
      reason: "initial",
      cardInstanceIds: drawnCardIds,
    });

    for (const attribute of [
      "attributeA",
      "attributeB",
      "attributeC",
    ] as const) {
      const amount = player.mana[attribute].total;
      if (amount > 0) {
        events.push({
          type: "MANA_GAINED",
          playerId: player.playerId,
          attribute,
          amount,
        });
      }
    }
  }

  events.push(
    { type: "GAME_STARTED", firstPlayerId },
    {
      type: "ROUND_STARTED",
      round: 1,
      firstPlayerId,
      secondPlayerId,
    },
    {
      type: "PHASE_CHANGED",
      phase: "firstPlayerPlacement",
      phaseSequence: 1,
      deadlineAt: phaseDeadlineAt,
    },
  );

  return events;
}

function validateClockValue(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("時計は有限数の時刻を返す必要があります。");
  }
  return value;
}
