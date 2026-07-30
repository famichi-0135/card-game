import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AuthenticatedGameCommand } from "@disastar/contracts/game";
import type {
  GameCommand,
  InitializeGameInput,
} from "@disastar/game-engine/contracts";
import type {
  GetGameSnapshotResult,
  SubmitGameCommandResult,
} from "../src/game-session/game-session.js";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
} from "../src/game-engine/runtime.js";

describe("拒否されたゲームコマンドの冪等性", () => {
  it("後から合法になっても、同じcommandIdの再送には最初の拒否結果を返す", async () => {
    const gameId = "rejected-command-idempotency";
    const session = getGameSession(gameId);
    await expect(
      session.initialize(createInitializeInput(gameId)),
    ).resolves.toEqual({ initialized: true });

    const firstSnapshot = await requireSnapshot(session, "player-1");
    const activePlayerId = firstSnapshot.view.firstPlayerId;
    const deferredPlayerId =
      activePlayerId === "player-1" ? "player-2" : "player-1";
    const rejectedCommand: GameCommand = {
      type: "FINISH_PLACEMENT",
      commandId: "finish-before-own-placement-turn",
      gameId,
      playerId: deferredPlayerId,
      phaseSequence: firstSnapshot.view.phaseSequence,
      clientStateVersion: firstSnapshot.view.stateVersion,
      issuedAt: 0,
    };

    const firstRejection = await session.submit({
      authenticatedPlayerId: deferredPlayerId,
      receivedAt: Date.now(),
      command: rejectedCommand,
    });
    expect(firstRejection).toMatchObject({
      submitted: true,
      response: {
        accepted: false,
        commandId: rejectedCommand.commandId,
        error: { code: "NOT_CURRENT_PLAYER" },
      },
    });

    const finishedByActivePlayer = await session.submit({
      authenticatedPlayerId: activePlayerId,
      receivedAt: Date.now(),
      command: {
        type: "FINISH_PLACEMENT",
        commandId: "finish-active-player-placement",
        gameId,
        playerId: activePlayerId,
        phaseSequence: firstSnapshot.view.phaseSequence,
        clientStateVersion: firstSnapshot.view.stateVersion,
        issuedAt: 0,
      },
    });
    expect(finishedByActivePlayer).toMatchObject({
      submitted: true,
      response: { accepted: true },
    });

    const retry = await session.submit({
      authenticatedPlayerId: deferredPlayerId,
      receivedAt: Date.now(),
      command: rejectedCommand,
    });
    expect(retry).toEqual(firstRejection);

    const snapshotAfterRetry = await requireSnapshot(session, deferredPlayerId);
    expect(snapshotAfterRetry.view).toMatchObject({
      phase: "secondPlayerPlacement",
      stateVersion: firstSnapshot.view.stateVersion + 1,
    });
  });
});

type GameSessionRpc = {
  initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
  getSnapshot(
    viewerPlayerId: string,
    afterSequence?: number,
  ): Promise<GetGameSnapshotResult>;
  submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResult>;
};

function getGameSession(gameId: string): GameSessionRpc {
  const gameSessions = env.GAME_SESSION as unknown as {
    getByName(name: string): GameSessionRpc;
  };
  return gameSessions.getByName(gameId);
}

async function requireSnapshot(session: GameSessionRpc, playerId: string) {
  const result = await session.getSnapshot(playerId, 0);
  if (!result.found) {
    throw new Error(
      `プレイヤー ${playerId} のスナップショットを取得できませんでした。`,
    );
  }
  return result.snapshot;
}

function createInitializeInput(gameId: string): InitializeGameInput {
  return {
    gameId,
    randomSeed: `${gameId}-seed`,
    players: [
      {
        playerId: "player-1",
        faction: "disaster",
        deckDefinitionIds: createDisasterStarterDeckDefinitionIds(),
      },
      {
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: createCountermeasureStarterDeckDefinitionIds(),
      },
    ],
  };
}
