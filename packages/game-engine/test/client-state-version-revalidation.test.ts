import { describe, expect, it } from "vitest";
import {
  executeCommand,
  initializeGame,
  type GameCommand,
  type GameState,
} from "../src/index.js";
import {
  createDependencies,
  createInitializationInput,
  createTestContext,
} from "./fixtures.js";

describe("古いクライアント状態の再検証", () => {
  it("同じフェーズ内で別の合法操作が先行しても、古い状態の操作を最新状態で再検証する", () => {
    const context = createTestContext();
    const state = initializeState(context);
    const playerId = state.firstPlayerId;
    const hand = state.players[playerId]?.hand;
    const firstCardInstanceId = hand?.[0];
    const staleCardInstanceId = hand?.[1];
    if (
      firstCardInstanceId === undefined ||
      staleCardInstanceId === undefined
    ) {
      throw new Error("再検証テストに必要な手札が不足しています。");
    }

    const staleCommand: GameCommand = {
      type: "DISCARD_HAND_CARD",
      commandId: "discard-created-from-stale-view",
      gameId: state.gameId,
      playerId,
      phaseSequence: state.phaseSequence,
      clientStateVersion: state.stateVersion,
      issuedAt: state.phaseStartedAt,
      cardInstanceId: staleCardInstanceId,
    };
    const firstCommand: GameCommand = {
      type: "DISCARD_HAND_CARD",
      commandId: "discard-first",
      gameId: state.gameId,
      playerId,
      phaseSequence: state.phaseSequence,
      clientStateVersion: state.stateVersion,
      issuedAt: state.phaseStartedAt,
      cardInstanceId: firstCardInstanceId,
    };

    const firstResult = executeCommand(
      state,
      { command: firstCommand, receivedAt: state.phaseStartedAt + 1 },
      context,
      createDependencies(),
    );
    expect(firstResult).toMatchObject({ accepted: true });
    if (!firstResult.accepted) {
      throw new Error(firstResult.error.message);
    }

    const staleResult = executeCommand(
      firstResult.state,
      { command: staleCommand, receivedAt: state.phaseStartedAt + 2 },
      context,
      createDependencies(),
    );

    expect(staleResult).toMatchObject({ accepted: true });
    if (!staleResult.accepted) {
      throw new Error(staleResult.error.message);
    }
    expect(staleResult.state.phaseSequence).toBe(state.phaseSequence);
    expect(staleResult.state.stateVersion).toBe(state.stateVersion + 2);
    expect(staleResult.state.players[playerId]?.discardPile).toEqual(
      expect.arrayContaining([firstCardInstanceId, staleCardInstanceId]),
    );
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
