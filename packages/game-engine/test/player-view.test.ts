import { describe, expect, it } from "vitest";
import {
  createPlayerView,
  executeCommand,
  initializeGame,
  projectEventForPlayer,
} from "../src/index.js";
import type { GameEventEnvelope, GameState } from "../src/contracts/index.js";
import {
  createDependencies,
  createInitializationInput,
  createTestContext,
} from "./fixtures.js";

describe("プレイヤー向け公開状態", () => {
  it("自分の手札だけを公開し、相手の手札と双方の山札内容を隠す", () => {
    const state = initializeState();
    const viewerPlayerId = state.playerOrder[0];
    const opponentPlayerId = state.playerOrder[1];
    const view = createPlayerView(state, viewerPlayerId, createTestContext());

    expect(view.self.faction).toBe(state.players[viewerPlayerId]?.faction);
    expect(view.opponent.faction).toBe(
      state.players[opponentPlayerId]?.faction,
    );

    expect(view.self.hand).toEqual(
      state.players[viewerPlayerId]?.hand.map(
        (cardInstanceId) => state.cardInstances[cardInstanceId],
      ),
    );
    expect(view.opponent.handCount).toBe(
      state.players[opponentPlayerId]?.hand.length,
    );
    expect(view.opponent.deckCount).toBe(
      state.players[opponentPlayerId]?.deck.length,
    );
    expect(view.opponent).not.toHaveProperty("hand");
    expect(view).not.toHaveProperty("initialRandomSeed");
    expect(JSON.stringify(view)).not.toContain(
      state.players[opponentPlayerId]?.hand[0] ?? "",
    );
    expect(JSON.stringify(view)).not.toContain(
      state.players[viewerPlayerId]?.deck[0] ?? "",
    );
    expect(view).not.toHaveProperty("engineSemanticsVersion");
  });

  it("自分のドローイベントにだけカードインスタンスIDを含める", () => {
    const state = initializeState();
    const drawingPlayerId = state.playerOrder[0];
    const otherPlayerId = state.playerOrder[1];
    const drawnCardIds = state.players[drawingPlayerId]?.hand.slice(0, 2);
    if (drawnCardIds === undefined || drawnCardIds.length !== 2) {
      throw new Error("テスト用の初期手札が不足しています。");
    }
    const envelope: GameEventEnvelope = {
      sequence: 42,
      stateVersion: state.stateVersion,
      occurredAt: 2_000,
      event: {
        type: "CARDS_DRAWN",
        playerId: drawingPlayerId,
        reason: "effect",
        cardInstanceIds: drawnCardIds,
      },
    };

    expect(projectEventForPlayer(envelope, drawingPlayerId)).toEqual({
      ...envelope,
      event: {
        type: "CARDS_DRAWN",
        playerId: drawingPlayerId,
        reason: "effect",
        count: drawnCardIds.length,
        cardInstanceIds: drawnCardIds,
      },
    });
    expect(projectEventForPlayer(envelope, otherPlayerId)).toEqual({
      ...envelope,
      event: {
        type: "CARDS_DRAWN",
        playerId: drawingPlayerId,
        reason: "effect",
        count: drawnCardIds.length,
      },
    });
  });

  it("盤面表示に固定枠とサーバー計算済みの攻撃力・みなもとを含める", () => {
    const context = createTestContext();
    const state = initializeState(context);
    const playerId = state.firstPlayerId;
    const cardInstanceId = state.players[playerId]?.hand.find((candidate) => {
      const definitionId = state.cardInstances[candidate]?.definitionId;
      return (
        context.cardCatalog.definitions[definitionId ?? ""]?.cardType ===
        "attack"
      );
    });
    if (cardInstanceId === undefined) {
      throw new Error("テスト用の攻撃カードが手札にありません。");
    }

    const result = executeCommand(
      state,
      {
        command: {
          type: "PLACE_ATTACK_CARD",
          commandId: "place-for-view",
          gameId: state.gameId,
          playerId,
          phaseSequence: state.phaseSequence,
          clientStateVersion: state.stateVersion,
          issuedAt: 0,
          cardInstanceId,
          slotIndex: 2,
          effectInputs: [],
        },
        receivedAt: state.phaseStartedAt + 1,
      },
      context,
      createDependencies(),
    );
    if (!result.accepted) {
      throw new Error(result.error.message);
    }

    const view = createPlayerView(result.state, playerId, context);
    expect(view.self.attackGroups).toEqual([
      expect.objectContaining({
        slotIndex: 2,
        requiredMana: 0,
        currentPower: expect.any(Number),
      }),
    ]);
    expect(view.self.mana.attributeA).toEqual({
      total: result.state.players[playerId]?.mana.attributeA.total,
      reserved: 0,
      available: result.state.players[playerId]?.mana.attributeA.total,
    });
  });
});

function initializeState(context = createTestContext()): GameState {
  const initialized = initializeGame(
    createInitializationInput(),
    context,
    createDependencies(),
  );
  if (!initialized.initialized) {
    throw new Error(initialized.error.message);
  }
  return initialized.state;
}
