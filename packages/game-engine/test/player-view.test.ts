import { describe, expect, it } from "vitest";
import {
  createPlayerView,
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
    const view = createPlayerView(state, viewerPlayerId);

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
});

function initializeState(): GameState {
  const initialized = initializeGame(
    createInitializationInput(),
    createTestContext(),
    createDependencies(),
  );
  if (!initialized.initialized) {
    throw new Error(initialized.error.message);
  }
  return initialized.state;
}
