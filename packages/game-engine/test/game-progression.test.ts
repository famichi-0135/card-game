import { describe, expect, it } from "vitest";
import {
  createCardCatalog,
  executeCommand,
  initializeGame,
  validateGameState,
} from "../src/index.js";
import type {
  CardCatalogInput,
  GameCommand,
  GameEngineContext,
  GameState,
  PlayerId,
} from "../src/contracts/index.js";
import {
  createDependencies,
  createInitializationInput,
  createSequenceRandomGenerator,
  createTestCardCatalogInput,
  createTestContext,
} from "./fixtures.js";

describe("効果なしのゲーム進行", () => {
  it("配置、連鎖、捨て札、場の整理、ラウンド開始を原子的に処理する", () => {
    const context = createContextWithSelfChain();
    let state = initializeForProgression(context);
    const firstPlayerId = state.firstPlayerId;
    const secondPlayerId = state.secondPlayerId;
    const firstPlayer = getPlayer(state, firstPlayerId);
    const firstCardId = findCardInstanceId(state, firstPlayerId, "attack-1");
    const chainedCardId = moveDeckCardToHand(state, firstPlayerId, "attack-1");

    const placed = submit(
      state,
      firstPlayerId,
      {
        type: "PLACE_ATTACK_CARD",
        cardInstanceId: firstCardId,
        slotIndex: 0,
        effectInputs: [],
      },
      "place",
      context,
    );
    expect(placed.events.map((entry) => entry.event.type)).toEqual([
      "ATTACK_GROUP_CREATED",
    ]);
    state = placed.state;
    const groupId = getPlayer(state, firstPlayerId).battlefield.attackGroups[0]
      ?.groupId;
    expect(groupId).toBeDefined();
    if (groupId === undefined) {
      throw new Error("攻撃グループが作成されませんでした。");
    }

    const chained = submit(
      state,
      firstPlayerId,
      {
        type: "CHAIN_ATTACK_CARD",
        cardInstanceId: chainedCardId,
        targetGroupId: groupId,
        effectInputs: [],
      },
      "chain",
      context,
    );
    expect(chained.events.map((entry) => entry.event.type)).toEqual([
      "CARD_CHAINED",
    ]);
    state = chained.state;

    state = submit(
      state,
      firstPlayerId,
      { type: "FINISH_PLACEMENT" },
      "finish-first",
      context,
    ).state;
    const discardedCardId = findCardInstanceId(
      state,
      secondPlayerId,
      "attack-1",
    );
    state = submit(
      state,
      secondPlayerId,
      { type: "DISCARD_HAND_CARD", cardInstanceId: discardedCardId },
      "discard",
      context,
    ).state;
    state = submit(
      state,
      secondPlayerId,
      { type: "FINISH_PLACEMENT" },
      "finish-second",
      context,
    ).state;
    state = submit(
      state,
      firstPlayerId,
      { type: "FINISH_SUPPORT" },
      "support-first",
      context,
    ).state;
    const resolved = submit(
      state,
      secondPlayerId,
      { type: "FINISH_SUPPORT" },
      "support-second",
      context,
    );

    expect(resolved.events.map((entry) => entry.event.type)).toContain(
      "ROUND_RESOLVED",
    );
    expect(resolved.state.round).toBe(2);
    expect(resolved.state.phase).toBe("firstPlayerPlacement");
    expect(
      getPlayer(resolved.state, firstPlayerId).battlefield.attackGroups,
    ).toEqual([
      expect.objectContaining({
        groupId,
        cardIds: [firstCardId, chainedCardId],
      }),
    ]);
    expect(getPlayer(resolved.state, firstPlayerId).discardPile).not.toEqual(
      expect.arrayContaining([firstCardId, chainedCardId]),
    );
    expect(getPlayer(resolved.state, secondPlayerId).discardPile).toContain(
      discardedCardId,
    );
    expect(getPlayer(resolved.state, secondPlayerId).stamina).toBe(23);
    expect(validateGameState(resolved.state, context)).toEqual({ valid: true });
    expect(firstPlayer.playerId).toBe(firstPlayerId);
  });

  it("古いクライアント状態を最新状態へ再検証し、重複と未来の状態を拒否する", () => {
    const context = createTestContext();
    const state = initializeForProgression(context);
    const playerId = state.firstPlayerId;
    const cardInstanceId = findCardInstanceId(state, playerId, "attack-1");
    const command = createCommand(
      state,
      playerId,
      {
        type: "DISCARD_HAND_CARD",
        cardInstanceId,
      },
      "discard-once",
      0,
    );

    const accepted = executeCommand(
      state,
      { command, receivedAt: state.phaseStartedAt + 1 },
      context,
      createDependencies(),
    );
    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) {
      throw new Error(accepted.error.message);
    }
    expect(accepted.state.stateVersion).toBe(state.stateVersion + 1);

    const duplicated = executeCommand(
      accepted.state,
      { command, receivedAt: accepted.state.phaseStartedAt + 2 },
      context,
      createDependencies(),
    );
    expect(duplicated).toMatchObject({
      accepted: false,
      error: { code: "COMMAND_ALREADY_PROCESSED" },
    });

    const futureStateCommand = createCommand(
      accepted.state,
      playerId,
      { type: "FINISH_PLACEMENT" },
      "future-state",
      accepted.state.stateVersion + 1,
    );
    const rejectedFuture = executeCommand(
      accepted.state,
      {
        command: futureStateCommand,
        receivedAt: accepted.state.phaseStartedAt + 2,
      },
      context,
      createDependencies(),
    );
    expect(rejectedFuture).toMatchObject({
      accepted: false,
      error: { code: "CLIENT_STATE_VERSION_AHEAD" },
    });
  });

  it("みなもと予約が不足する配置を拒否し、元の状態を変更しない", () => {
    const context = createContextWithAttackCost(4);
    const state = initializeForProgression(context);
    const playerId = state.firstPlayerId;
    const cardInstanceId = findCardInstanceId(state, playerId, "attack-1");
    const result = executeCommand(
      state,
      {
        command: createCommand(
          state,
          playerId,
          {
            type: "PLACE_ATTACK_CARD",
            cardInstanceId,
            slotIndex: 0,
            effectInputs: [],
          },
          "insufficient-mana",
          state.stateVersion,
        ),
        receivedAt: state.phaseStartedAt + 1,
      },
      context,
      createDependencies(),
    );

    expect(result).toMatchObject({
      accepted: false,
      error: { code: "INSUFFICIENT_MANA" },
    });
    expect(result.state).toBe(state);
    expect(getPlayer(state, playerId).hand).toContain(cardInstanceId);
    expect(getPlayer(state, playerId).battlefield.attackGroups).toEqual([]);
  });

  it("攻撃グループを指定した固定枠に配置し、使用中の枠を拒否する", () => {
    const context = createTestContext();
    const state = initializeForProgression(context);
    const playerId = state.firstPlayerId;
    const firstCardInstanceId = findCardInstanceId(state, playerId, "attack-1");
    const placed = submit(
      state,
      playerId,
      {
        type: "PLACE_ATTACK_CARD",
        cardInstanceId: firstCardInstanceId,
        slotIndex: 3,
        effectInputs: [],
      },
      "place-in-slot-three",
      context,
    );
    const secondCardInstanceId = moveDeckCardToHand(
      placed.state,
      playerId,
      "attack-1",
    );
    const duplicateSlot = executeCommand(
      placed.state,
      {
        command: createCommand(
          placed.state,
          playerId,
          {
            type: "PLACE_ATTACK_CARD",
            cardInstanceId: secondCardInstanceId,
            slotIndex: 3,
            effectInputs: [],
          },
          "place-in-used-slot",
          placed.state.stateVersion,
        ),
        receivedAt: placed.state.phaseStartedAt + 1,
      },
      context,
      createDependencies(),
    );

    expect(placed.state.players[playerId]?.battlefield.attackGroups).toEqual([
      expect.objectContaining({ slotIndex: 3 }),
    ]);
    expect(duplicateSlot).toMatchObject({
      accepted: false,
      error: { code: "ATTACK_GROUP_SLOT_UNAVAILABLE" },
    });
  });

  it("期限到達時だけフェーズを進め、古いタイムアウトを無害にする", () => {
    const context = createTestContext();
    const state = initializeForProgression(context);
    const command = {
      type: "HANDLE_PHASE_TIMEOUT" as const,
      gameId: state.gameId,
      phaseSequence: state.phaseSequence,
    };

    const early = executeCommand(
      state,
      { command, receivedAt: (state.phaseDeadlineAt ?? 0) - 1 },
      context,
      createDependencies(),
    );
    expect(early).toMatchObject({ accepted: true, state, events: [] });

    const timedOut = executeCommand(
      state,
      { command, receivedAt: state.phaseDeadlineAt ?? 0 },
      context,
      createDependencies(),
    );
    expect(timedOut.accepted).toBe(true);
    if (!timedOut.accepted) {
      throw new Error(timedOut.error.message);
    }
    expect(timedOut.state).toMatchObject({
      phase: "secondPlayerPlacement",
      stateVersion: state.stateVersion + 1,
      phaseSequence: state.phaseSequence + 1,
    });

    const stale = executeCommand(
      timedOut.state,
      { command, receivedAt: (timedOut.state.phaseDeadlineAt ?? 0) + 1 },
      context,
      createDependencies(),
    );
    expect(stale).toMatchObject({
      accepted: true,
      state: timedOut.state,
      events: [],
    });
  });

  it("操作担当者が期限までに復帰しない場合は切断敗北にする", () => {
    const context = createTestContext();
    const state = initializeForProgression(context);
    const result = executeCommand(
      state,
      {
        command: {
          type: "HANDLE_DISCONNECT_TIMEOUT",
          gameId: state.gameId,
          phaseSequence: state.phaseSequence,
          disconnectedPlayerIds: [state.firstPlayerId],
        },
        receivedAt: state.phaseDeadlineAt ?? 0,
      },
      context,
      createDependencies(),
    );

    expect(result).toMatchObject({
      accepted: true,
      state: {
        status: "finished",
        phase: "finished",
        winner: {
          type: "player",
          playerId: state.secondPlayerId,
          reason: "disconnectTimeout",
        },
      },
    });
    if (result.accepted) {
      expect(result.events.map((entry) => entry.event.type)).toContain(
        "GAME_FINISHED",
      );
    }
  });

  it("サポートフェーズで両者が切断中なら引き分けにする", () => {
    const context = createTestContext();
    let state = initializeForProgression(context);
    state = submit(
      state,
      state.firstPlayerId,
      { type: "FINISH_PLACEMENT" },
      "disconnect-finish-first",
      context,
    ).state;
    state = submit(
      state,
      state.secondPlayerId,
      { type: "FINISH_PLACEMENT" },
      "disconnect-finish-second",
      context,
    ).state;

    const result = executeCommand(
      state,
      {
        command: {
          type: "HANDLE_DISCONNECT_TIMEOUT",
          gameId: state.gameId,
          phaseSequence: state.phaseSequence,
          disconnectedPlayerIds: [...state.playerOrder],
        },
        receivedAt: state.phaseDeadlineAt ?? 0,
      },
      context,
      createDependencies(),
    );

    expect(result).toMatchObject({
      accepted: true,
      state: {
        status: "finished",
        winner: { type: "draw", reason: "bothDisconnected" },
      },
    });
  });

  it("同じ固定デッキとseedから、効果なしで山札切れまで同じ対戦結果を再現する", () => {
    const first = runMatchToEnd();
    const second = runMatchToEnd();

    expect(first).toEqual(second);
    expect(first.status).toBe("finished");
    expect(first.phase).toBe("finished");
    expect(first.winner).toEqual({
      type: "draw",
      reason: "deckOutEqualStamina",
    });
    expect(first.round).toBeLessThanOrEqual(
      createTestContext().rules.maxRounds,
    );
    expect(validateGameState(first, createTestContext())).toEqual({
      valid: true,
    });
  });
});

function createContextWithSelfChain(): GameEngineContext {
  const input: CardCatalogInput = createTestCardCatalogInput();
  const attack = input.definitions.find(
    (definition) => definition.id === "attack-1",
  );
  if (attack === undefined || attack.cardType !== "attack") {
    throw new Error("テスト用攻撃カードが見つかりません。");
  }
  attack.chainableCardIds = ["attack-1"];
  const counterAttack = input.definitions.find(
    (definition) => definition.id === "counter-attack-1",
  );
  if (counterAttack === undefined || counterAttack.cardType !== "attack") {
    throw new Error("対策側のテスト用攻撃カードが見つかりません。");
  }
  counterAttack.chainableCardIds = ["counter-attack-1"];

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

function createContextWithAttackCost(cost: number): GameEngineContext {
  const input = createTestCardCatalogInput();
  const attack = input.definitions.find(
    (definition) => definition.id === "attack-1",
  );
  if (attack === undefined || attack.cardType !== "attack") {
    throw new Error("テスト用攻撃カードが見つかりません。");
  }
  attack.cost = cost;
  const counterAttack = input.definitions.find(
    (definition) => definition.id === "counter-attack-1",
  );
  if (counterAttack === undefined || counterAttack.cardType !== "attack") {
    throw new Error("対策側のテスト用攻撃カードが見つかりません。");
  }
  counterAttack.cost = cost;

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

function initializeForProgression(context: GameEngineContext): GameState {
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

function runMatchToEnd(): GameState {
  const context = createTestContext();
  let state = initializeForProgression(context);
  let commandSequence = 0;

  while (state.status === "active") {
    if (commandSequence > 200) {
      throw new Error("対戦が想定回数内に終了しませんでした。");
    }
    const playerId =
      state.phase === "firstPlayerPlacement"
        ? state.firstPlayerId
        : state.phase === "secondPlayerPlacement"
          ? state.secondPlayerId
          : state.playerOrder.find(
              (id) => !state.supportFinishedBy.includes(id),
            );
    if (
      playerId === undefined ||
      state.phase === "resolution" ||
      state.phase === "cleanup" ||
      state.phase === "refill"
    ) {
      throw new Error(`自動処理フェーズ ${state.phase} が残っています。`);
    }
    const handCardId = getPlayer(state, playerId).hand[0];
    const command: CommandInput =
      state.phase === "support"
        ? { type: "FINISH_SUPPORT" }
        : handCardId === undefined
          ? { type: "FINISH_PLACEMENT" }
          : { type: "DISCARD_HAND_CARD", cardInstanceId: handCardId };
    state = submit(state, playerId, command, `match-${commandSequence}`).state;
    commandSequence += 1;
  }

  return state;
}

function submit(
  state: GameState,
  playerId: PlayerId,
  command: CommandInput,
  commandId: string,
  context: GameEngineContext = createTestContext(),
): Extract<ReturnType<typeof executeCommand>, { accepted: true }> {
  const result = executeCommand(
    state,
    {
      command: createCommand(
        state,
        playerId,
        command,
        commandId,
        state.stateVersion,
      ),
      receivedAt: state.phaseStartedAt + 1,
    },
    context,
    createDependencies(),
  );
  if (!result.accepted) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result;
}

type CommandInput =
  | {
      type: "PLACE_ATTACK_CARD";
      cardInstanceId: string;
      slotIndex: 0 | 1 | 2 | 3 | 4;
      effectInputs: [];
    }
  | {
      type: "CHAIN_ATTACK_CARD";
      cardInstanceId: string;
      targetGroupId: string;
      effectInputs: [];
    }
  | { type: "DISCARD_HAND_CARD"; cardInstanceId: string }
  | { type: "FINISH_PLACEMENT" }
  | { type: "FINISH_SUPPORT" };

function createCommand(
  state: GameState,
  playerId: PlayerId,
  input: CommandInput,
  commandId: string,
  clientStateVersion: number,
): GameCommand {
  return {
    ...input,
    commandId,
    gameId: state.gameId,
    playerId,
    phaseSequence: state.phaseSequence,
    clientStateVersion,
    issuedAt: 0,
  } as GameCommand;
}

function getPlayer(state: GameState, playerId: PlayerId) {
  const player = state.players[playerId];
  if (player === undefined) {
    throw new Error(`プレイヤー ${playerId} が見つかりません。`);
  }
  return player;
}

function findCardInstanceId(
  state: GameState,
  playerId: PlayerId,
  definitionId: string,
): string {
  const player = getPlayer(state, playerId);
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
  playerId: PlayerId,
  definitionId: string,
): string {
  const player = getPlayer(state, playerId);
  const factionDefinitionId =
    player.faction === "countermeasure"
      ? `counter-${definitionId}`
      : definitionId;
  const index = player.deck.findIndex(
    (id) => state.cardInstances[id]?.definitionId === factionDefinitionId,
  );
  if (index < 0) {
    throw new Error(`山札に ${definitionId} がありません。`);
  }
  const cardInstanceId = player.deck[index];
  if (cardInstanceId === undefined) {
    throw new Error("山札のカードを取得できません。");
  }
  player.deck.splice(index, 1);
  player.hand.push(cardInstanceId);
  return cardInstanceId;
}
