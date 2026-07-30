import { describe, expect, it } from "vitest";
import {
  GAME_RULES,
  createCardCatalog,
  executeCommand,
  initializeGame,
} from "../src/index.js";
import type {
  CardCatalogInput,
  EffectInput,
  GameCommand,
  GameEngineContext,
  GameState,
  PlayerId,
} from "../src/contracts/index.js";
import {
  createDependencies,
  createInitializationInput,
  createTestCardCatalogInput,
  createTestContext,
} from "./fixtures.js";

describe("ゲーム操作の境界条件", () => {
  it("攻撃グループは5つの固定枠まで配置でき、6つ目では状態を変えない", () => {
    const context = createTestContext();
    let state = initializeState(context);
    const playerId = state.firstPlayerId;

    for (const slotIndex of [0, 1, 2, 3, 4] as const) {
      const cardInstanceId = takeCardFromHandOrDeck(
        state,
        playerId,
        `attack-${slotIndex + 1}`,
      );
      state = requireAccepted(
        executePlayerCommand(
          state,
          playerId,
          {
            type: "PLACE_ATTACK_CARD",
            cardInstanceId,
            slotIndex,
            effectInputs: [],
          },
          `place-slot-${slotIndex}`,
          context,
        ),
      ).state;
    }

    const sixthCardInstanceId = takeCardFromHandOrDeck(
      state,
      playerId,
      "attack-6",
    );
    const rejected = executePlayerCommand(
      state,
      playerId,
      {
        type: "PLACE_ATTACK_CARD",
        cardInstanceId: sixthCardInstanceId,
        slotIndex: 0,
        effectInputs: [],
      },
      "place-sixth-group",
      context,
    );

    expect(rejected).toMatchObject({
      accepted: false,
      error: { code: "ATTACK_GROUP_LIMIT_REACHED" },
      state,
    });
    expect(getPlayer(state, playerId).battlefield.attackGroups).toEqual(
      expect.arrayContaining(
        [0, 1, 2, 3, 4].map((slotIndex) =>
          expect.objectContaining({ slotIndex }),
        ),
      ),
    );
    expect(getPlayer(state, playerId).hand).toContain(sixthCardInstanceId);
  });

  it("配置、連鎖、破棄に使用済みの同一カードを再利用できない", () => {
    const context = createContextWithChain();
    let state = initializeState(context);
    const playerId = state.firstPlayerId;
    const placedCardInstanceId = takeCardFromHandOrDeck(
      state,
      playerId,
      "attack-1",
    );
    const placed = requireAccepted(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "PLACE_ATTACK_CARD",
          cardInstanceId: placedCardInstanceId,
          slotIndex: 0,
          effectInputs: [],
        },
        "place-once",
        context,
      ),
    );
    state = placed.state;
    const groupId = getPlayer(state, playerId).battlefield.attackGroups[0]
      ?.groupId;
    if (groupId === undefined) {
      throw new Error("攻撃グループが作成されませんでした。");
    }

    expect(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "PLACE_ATTACK_CARD",
          cardInstanceId: placedCardInstanceId,
          slotIndex: 1,
          effectInputs: [],
        },
        "place-same-card-again",
        context,
      ),
    ).toMatchObject({
      accepted: false,
      error: { code: "CARD_NOT_IN_HAND" },
      state,
    });

    const chainedCardInstanceId = takeCardFromHandOrDeck(
      state,
      playerId,
      "attack-2",
    );
    state = requireAccepted(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "CHAIN_ATTACK_CARD",
          cardInstanceId: chainedCardInstanceId,
          targetGroupId: groupId,
          effectInputs: [],
        },
        "chain-once",
        context,
      ),
    ).state;
    expect(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "CHAIN_ATTACK_CARD",
          cardInstanceId: chainedCardInstanceId,
          targetGroupId: groupId,
          effectInputs: [],
        },
        "chain-same-card-again",
        context,
      ),
    ).toMatchObject({
      accepted: false,
      error: { code: "CARD_NOT_IN_HAND" },
      state,
    });

    const discardedCardInstanceId = takeCardFromHandOrDeck(
      state,
      playerId,
      "attack-3",
    );
    state = requireAccepted(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "DISCARD_HAND_CARD",
          cardInstanceId: discardedCardInstanceId,
        },
        "discard-once",
        context,
      ),
    ).state;
    expect(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "DISCARD_HAND_CARD",
          cardInstanceId: discardedCardInstanceId,
        },
        "discard-same-card-again",
        context,
      ),
    ).toMatchObject({
      accepted: false,
      error: { code: "CARD_NOT_IN_HAND" },
      state,
    });
  });

  it("サポートのコスト不足を拒否し、使用済みカードを再利用できない", () => {
    const insufficientManaContext = createContextWithSupportCost(1);
    const insufficientManaState = advanceToSupportPhase(
      insufficientManaContext,
    );
    const insufficientManaPlayerId = insufficientManaState.firstPlayerId;
    const insufficientManaSupportId = takeCardFromHandOrDeck(
      insufficientManaState,
      insufficientManaPlayerId,
      "support-1",
    );
    getPlayer(
      insufficientManaState,
      insufficientManaPlayerId,
    ).mana.attributeA.total = 0;

    const insufficientMana = executePlayerCommand(
      insufficientManaState,
      insufficientManaPlayerId,
      {
        type: "PLAY_SUPPORT_CARD",
        cardInstanceId: insufficientManaSupportId,
        effectInputs: supportOneEffectInputs(),
      },
      "support-insufficient-mana",
      insufficientManaContext,
    );
    expect(insufficientMana).toMatchObject({
      accepted: false,
      error: { code: "INSUFFICIENT_MANA" },
      state: insufficientManaState,
    });
    expect(
      getPlayer(insufficientManaState, insufficientManaPlayerId).hand,
    ).toContain(insufficientManaSupportId);

    const context = createTestContext();
    let state = advanceToSupportPhase(context);
    const playerId = state.firstPlayerId;
    const supportCardInstanceId = takeCardFromHandOrDeck(
      state,
      playerId,
      "support-1",
    );
    state = requireAccepted(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: supportOneEffectInputs(),
        },
        "play-support-once",
        context,
      ),
    ).state;

    expect(
      executePlayerCommand(
        state,
        playerId,
        {
          type: "PLAY_SUPPORT_CARD",
          cardInstanceId: supportCardInstanceId,
          effectInputs: supportOneEffectInputs(),
        },
        "play-same-support-again",
        context,
      ),
    ).toMatchObject({
      accepted: false,
      error: { code: "CARD_NOT_IN_HAND" },
      state,
    });
  });

  it("期限ちょうどのフェーズ終了を受理し、古いフェーズの操作を拒否する", () => {
    const context = createTestContext();
    const state = initializeState(context);
    const playerId = state.firstPlayerId;
    const phaseSequence = state.phaseSequence;
    const deadlineAt = state.phaseDeadlineAt;
    if (deadlineAt === null) {
      throw new Error("配置フェーズには期限が必要です。");
    }

    const finished = requireAccepted(
      executePlayerCommand(
        state,
        playerId,
        { type: "FINISH_PLACEMENT" },
        "finish-at-deadline",
        context,
        { receivedAt: deadlineAt },
      ),
    );
    expect(finished.state).toMatchObject({
      phase: "secondPlayerPlacement",
      phaseSequence: phaseSequence + 1,
      stateVersion: state.stateVersion + 1,
    });

    const stale = executePlayerCommand(
      finished.state,
      playerId,
      { type: "FINISH_PLACEMENT" },
      "finish-stale-phase",
      context,
      { phaseSequence },
    );
    expect(stale).toMatchObject({
      accepted: false,
      error: { code: "PHASE_SEQUENCE_MISMATCH" },
      state: finished.state,
    });
  });
});

type PlayerCommandInput =
  | {
      type: "PLACE_ATTACK_CARD";
      cardInstanceId: string;
      slotIndex: 0 | 1 | 2 | 3 | 4;
      effectInputs: EffectInput[];
    }
  | {
      type: "CHAIN_ATTACK_CARD";
      cardInstanceId: string;
      targetGroupId: string;
      effectInputs: EffectInput[];
    }
  | { type: "DISCARD_HAND_CARD"; cardInstanceId: string }
  | {
      type: "PLAY_SUPPORT_CARD";
      cardInstanceId: string;
      effectInputs: EffectInput[];
    }
  | { type: "FINISH_PLACEMENT" };

function initializeState(context: GameEngineContext): GameState {
  const initialized = initializeGame(
    createInitializationInput(),
    context,
    createDependencies(),
  );
  if (!initialized.initialized) {
    throw new Error(`${initialized.error.code}: ${initialized.error.message}`);
  }
  return initialized.state;
}

function advanceToSupportPhase(context: GameEngineContext): GameState {
  let state = initializeState(context);
  state = requireAccepted(
    executePlayerCommand(
      state,
      state.firstPlayerId,
      { type: "FINISH_PLACEMENT" },
      "finish-first-placement",
      context,
    ),
  ).state;
  return requireAccepted(
    executePlayerCommand(
      state,
      state.secondPlayerId,
      { type: "FINISH_PLACEMENT" },
      "finish-second-placement",
      context,
    ),
  ).state;
}

function executePlayerCommand(
  state: GameState,
  playerId: PlayerId,
  input: PlayerCommandInput,
  commandId: string,
  context: GameEngineContext,
  overrides: { phaseSequence?: number; receivedAt?: number } = {},
) {
  const command = {
    ...input,
    commandId,
    gameId: state.gameId,
    playerId,
    phaseSequence: overrides.phaseSequence ?? state.phaseSequence,
    clientStateVersion: state.stateVersion,
    issuedAt: 0,
  } as GameCommand;
  return executeCommand(
    state,
    {
      command,
      receivedAt: overrides.receivedAt ?? state.phaseStartedAt + 1,
    },
    context,
    createDependencies(),
  );
}

function takeCardFromHandOrDeck(
  state: GameState,
  playerId: PlayerId,
  definitionId: string,
): string {
  const player = getPlayer(state, playerId);
  const factionDefinitionId =
    player.faction === "countermeasure"
      ? `counter-${definitionId}`
      : definitionId;
  const cardInHand = player.hand.find(
    (cardInstanceId) =>
      state.cardInstances[cardInstanceId]?.definitionId === factionDefinitionId,
  );
  if (cardInHand !== undefined) {
    return cardInHand;
  }

  const deckIndex = player.deck.findIndex(
    (cardInstanceId) =>
      state.cardInstances[cardInstanceId]?.definitionId === factionDefinitionId,
  );
  if (deckIndex < 0) {
    throw new Error(`${definitionId} が手札または山札にありません。`);
  }
  const [cardInstanceId] = player.deck.splice(deckIndex, 1);
  if (cardInstanceId === undefined) {
    throw new Error(`${definitionId} を山札から取得できません。`);
  }
  player.hand.push(cardInstanceId);
  return cardInstanceId;
}

function createContextWithChain(): GameEngineContext {
  return createContextWithCatalog((input) => {
    input.definitions = input.definitions.map((definition) => {
      if (definition.id === "attack-1") {
        return { ...definition, chainableCardIds: ["attack-2"] };
      }
      if (definition.id === "counter-attack-1") {
        return {
          ...definition,
          chainableCardIds: ["counter-attack-2"],
        };
      }
      if (
        definition.id === "attack-2" ||
        definition.id === "counter-attack-2"
      ) {
        return { ...definition, attribute: "attributeA" };
      }
      return definition;
    });
  });
}

function createContextWithSupportCost(cost: number): GameEngineContext {
  return createContextWithCatalog((input) => {
    input.definitions = input.definitions.map((definition) =>
      definition.id === "support-1" || definition.id === "counter-support-1"
        ? { ...definition, cost }
        : definition,
    );
  });
}

function createContextWithCatalog(
  configure: (input: CardCatalogInput) => void,
): GameEngineContext {
  const input = createTestCardCatalogInput();
  configure(input);
  const created = createCardCatalog(input, {
    rules: GAME_RULES,
    effectRegistry: {},
    engineSemanticsVersion: "engine-v1",
  });
  if (!created.valid) {
    throw new Error(created.errors.map((error) => error.message).join("\n"));
  }
  return {
    rules: GAME_RULES,
    cardCatalog: created.catalog,
    effectRegistry: {},
    engineSemanticsVersion: "engine-v1",
  };
}

function supportOneEffectInputs(): EffectInput[] {
  return [{ effectId: "draw-card-1", targets: [] }];
}

function getPlayer(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  if (player === undefined) {
    throw new Error(`プレイヤー ${playerId} が見つかりません。`);
  }
  return player;
}

function requireAccepted<T extends ReturnType<typeof executeCommand>>(
  result: T,
): Extract<T, { accepted: true }> {
  if (!result.accepted) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result as Extract<T, { accepted: true }>;
}
