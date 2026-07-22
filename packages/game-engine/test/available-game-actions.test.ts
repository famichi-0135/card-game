import { describe, expect, it } from "vitest";
import {
  createCardCatalog,
  createPlayerView,
  executeCommand,
  getAvailableGameActions,
  initializeGame,
  projectPublicCardCatalog,
} from "../src/index.js";
import type {
  CardCatalogInput,
  GameEngineContext,
  GameState,
  PlayerGameView,
  PublicCardCatalog,
} from "../src/contracts/index.js";
import {
  createDependencies,
  createInitializationInput,
  createSequenceRandomGenerator,
  createTestCardCatalogInput,
  createTestContext,
} from "./fixtures.js";

describe("公開状態からの合法手判定", () => {
  it("配置・連鎖候補から作ったコマンドをサーバーが受理する", () => {
    const context = createContextWithSelfChain(0);
    let state = initializeForActions(context);
    const playerId = state.firstPlayerId;
    const firstCardInstanceId = findCardInstanceId(state, playerId, "attack-1");
    const secondCardInstanceId = moveDeckCardToHand(
      state,
      playerId,
      "attack-1",
    );

    const firstActions = getActions(state, playerId, context);
    const firstCardActions = firstActions.handCards[firstCardInstanceId];
    const slotIndex = firstCardActions?.placeAttack.slotIndices[0];
    expect(slotIndex).toBe(0);
    expect(firstCardActions?.placeAttack.available).toBe(true);

    const placed = executeCommand(
      state,
      {
        command: {
          type: "PLACE_ATTACK_CARD",
          commandId: "place-from-available-actions",
          gameId: state.gameId,
          playerId,
          phaseSequence: state.phaseSequence,
          clientStateVersion: state.stateVersion,
          issuedAt: 0,
          cardInstanceId: firstCardInstanceId,
          slotIndex: slotIndex ?? 0,
          effectInputs: [],
        },
        receivedAt: state.phaseStartedAt + 1,
      },
      context,
      createDependencies(),
    );
    expect(placed.accepted).toBe(true);
    if (!placed.accepted) {
      throw new Error(placed.error.message);
    }
    state = placed.state;

    const chainedActions = getActions(state, playerId, context);
    const targetGroupId =
      chainedActions.handCards[secondCardInstanceId]?.chainAttack
        .targetGroupIds[0];
    expect(targetGroupId).toBeDefined();
    expect(
      chainedActions.handCards[secondCardInstanceId]?.chainAttack.available,
    ).toBe(true);

    const chained = executeCommand(
      state,
      {
        command: {
          type: "CHAIN_ATTACK_CARD",
          commandId: "chain-from-available-actions",
          gameId: state.gameId,
          playerId,
          phaseSequence: state.phaseSequence,
          clientStateVersion: state.stateVersion,
          issuedAt: 0,
          cardInstanceId: secondCardInstanceId,
          targetGroupId: targetGroupId ?? "",
          effectInputs: [],
        },
        receivedAt: state.phaseStartedAt + 1,
      },
      context,
      createDependencies(),
    );
    expect(chained).toMatchObject({ accepted: true });
  });

  it("みなもとが不足する配置を候補に出さず、サーバーも拒否する", () => {
    const context = createContextWithSelfChain(1);
    const state = initializeForActions(context);
    const playerId = state.firstPlayerId;
    const cardInstanceId = findCardInstanceId(state, playerId, "attack-1");
    const definitionId = state.cardInstances[cardInstanceId]?.definitionId;
    const definition =
      definitionId === undefined
        ? undefined
        : context.cardCatalog.definitions[definitionId];
    if (definition?.cardType !== "attack") {
      throw new Error("テスト用攻撃カードが見つかりません。");
    }
    state.players[playerId]!.mana[definition.attribute].total = 0;

    const actions = getActions(state, playerId, context);
    expect(actions.handCards[cardInstanceId]?.placeAttack).toEqual({
      available: false,
      unavailableReason: "INSUFFICIENT_MANA",
      slotIndices: [],
    });

    const result = executeCommand(
      state,
      {
        command: {
          type: "PLACE_ATTACK_CARD",
          commandId: "reject-insufficient-mana",
          gameId: state.gameId,
          playerId,
          phaseSequence: state.phaseSequence,
          clientStateVersion: state.stateVersion,
          issuedAt: 0,
          cardInstanceId,
          slotIndex: 0,
          effectInputs: [],
        },
        receivedAt: state.phaseStartedAt + 1,
      },
      context,
      createDependencies(),
    );
    expect(result).toMatchObject({
      accepted: false,
      error: { code: "INSUFFICIENT_MANA" },
    });
  });

  it("サポート効果の対象候補と選択段階を公開情報だけで返す", () => {
    const view = createSupportPhaseView();
    const actions = getAvailableGameActions({
      view,
      catalog: createSupportCatalog(),
      now: 1_000,
    });

    expect(actions.handCards["support-card"]?.playSupport).toEqual({
      available: true,
      effectSelections: [
        {
          effectId: "remove-group",
          stageIndex: 0,
          required: true,
          minTargets: 1,
          maxTargets: 1,
          selectionOrder: "independent",
          candidates: [{ type: "attackGroup", groupId: "opponent-group" }],
        },
      ],
    });
  });

  it("期限切れとカタログ不一致を安定した理由コードで返す", () => {
    const view = createSupportPhaseView();
    const catalog = createSupportCatalog();

    expect(
      getAvailableGameActions({ view, catalog, now: 1_001 }).finishSupport,
    ).toEqual({
      available: false,
      unavailableReason: "PHASE_DEADLINE_EXPIRED",
    });
    expect(
      getAvailableGameActions({
        view,
        catalog: { ...catalog, version: "other-catalog" },
        now: 1_000,
      }).finishSupport,
    ).toEqual({
      available: false,
      unavailableReason: "CARD_CATALOG_VERSION_MISMATCH",
    });
  });
});

function getActions(
  state: GameState,
  playerId: string,
  context: GameEngineContext,
) {
  return getAvailableGameActions({
    view: createPlayerView(state, playerId, context),
    catalog: projectPublicCardCatalog(context.cardCatalog),
    now: state.phaseStartedAt + 1,
  });
}

function createContextWithSelfChain(cost: number): GameEngineContext {
  const input: CardCatalogInput = createTestCardCatalogInput();
  for (const definition of input.definitions) {
    if (
      definition.cardType === "attack" &&
      (definition.id === "attack-1" || definition.id === "counter-attack-1")
    ) {
      definition.cost = cost;
      definition.chainableCardIds = [definition.id];
    }
  }
  const baseContext = createTestContext();
  const catalogResult = createCardCatalog(input, {
    rules: baseContext.rules,
    effectRegistry: {},
    engineSemanticsVersion: baseContext.engineSemanticsVersion,
  });
  if (!catalogResult.valid) {
    throw new Error(
      catalogResult.errors.map((error) => error.message).join("\n"),
    );
  }
  return { ...baseContext, cardCatalog: catalogResult.catalog };
}

function initializeForActions(context: GameEngineContext): GameState {
  const result = initializeGame(
    createInitializationInput(),
    context,
    createDependencies(
      createSequenceRandomGenerator(Array<number>(59).fill(0.999_999)),
    ),
  );
  if (!result.initialized) {
    throw new Error(result.error.message);
  }
  return result.state;
}

function findCardInstanceId(
  state: GameState,
  playerId: string,
  definitionId: string,
): string {
  const player = state.players[playerId];
  if (player === undefined) {
    throw new Error("プレイヤーが見つかりません。");
  }
  const factionDefinitionId =
    player.faction === "countermeasure"
      ? `counter-${definitionId}`
      : definitionId;
  const cardInstanceId = player.hand.find(
    (id) => state.cardInstances[id]?.definitionId === factionDefinitionId,
  );
  if (cardInstanceId === undefined) {
    throw new Error(`手札に ${definitionId} がありません。`);
  }
  return cardInstanceId;
}

function moveDeckCardToHand(
  state: GameState,
  playerId: string,
  definitionId: string,
): string {
  const player = state.players[playerId];
  if (player === undefined) {
    throw new Error("プレイヤーが見つかりません。");
  }
  const factionDefinitionId =
    player.faction === "countermeasure"
      ? `counter-${definitionId}`
      : definitionId;
  const index = player.deck.findIndex(
    (id) => state.cardInstances[id]?.definitionId === factionDefinitionId,
  );
  const cardInstanceId = player.deck[index];
  if (cardInstanceId === undefined) {
    throw new Error(`山札に ${definitionId} がありません。`);
  }
  player.deck.splice(index, 1);
  player.hand.push(cardInstanceId);
  return cardInstanceId;
}

function createSupportPhaseView(): PlayerGameView {
  return {
    gameId: "game-1",
    rulesetVersion: "rules-v1",
    cardCatalogVersion: "catalog-v1",
    stateVersion: 1,
    status: "active",
    round: 1,
    phase: "support",
    phaseSequence: 3,
    phaseDeadlineAt: 1_000,
    firstPlayerId: "player-1",
    secondPlayerId: "player-2",
    viewerPlayerId: "player-1",
    self: {
      playerId: "player-1",
      faction: "disaster",
      stamina: 20,
      hand: [
        {
          instanceId: "support-card",
          definitionId: "support-1",
          ownerId: "player-1",
        },
      ],
      handCount: 1,
      deckCount: 20,
      discardPile: [],
      attackGroups: [],
      supportZone: [],
      mana: createMana(),
      activeEffects: [],
      supportFinished: false,
    },
    opponent: {
      playerId: "player-2",
      faction: "countermeasure",
      stamina: 20,
      handCount: 1,
      deckCount: 20,
      discardPile: [],
      attackGroups: [
        {
          groupId: "opponent-group",
          ownerId: "player-2",
          slotIndex: 0,
          attribute: "attributeA",
          createdRound: 1,
          cards: [
            {
              instanceId: "opponent-attack-card",
              definitionId: "attack-1",
              ownerId: "player-2",
            },
          ],
          requiredMana: 1,
          currentPower: 2,
        },
      ],
      supportZone: [],
      mana: createMana(),
      activeEffects: [],
      supportFinished: false,
    },
    lastRoundResult: null,
    winner: null,
  };
}

function createSupportCatalog(): PublicCardCatalog {
  return {
    version: "catalog-v1",
    definitions: {
      "support-1": {
        id: "support-1",
        name: "攻撃グループ除去",
        faction: "disaster",
        attribute: "attributeA",
        cardType: "support",
        cost: 2,
        duration: "instant",
        rulesText: "相手の攻撃グループを除去します。",
        imageAssetId: null,
        interaction: {
          chainableCardDefinitionIds: [],
          effects: [
            {
              effectId: "remove-group",
              activationType: "onPlay",
              target: {
                required: true,
                minTargets: 1,
                maxTargets: 1,
                side: "opponent",
                zones: ["attackGroup"],
                allowSourceCard: false,
                selectionOrder: "independent",
              },
            },
          ],
        },
      },
    },
  };
}

function createMana() {
  return {
    attributeA: { total: 10, reserved: 0, available: 10 },
    attributeB: { total: 10, reserved: 0, available: 10 },
    attributeC: { total: 10, reserved: 0, available: 10 },
  };
}
