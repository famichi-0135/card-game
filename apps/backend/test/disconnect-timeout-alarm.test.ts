import { env, runDurableObjectAlarm } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InitializeGameInput } from "@disastar/game-engine/contracts";
import type { GetGameSnapshotResult } from "../src/game-session/game-session.js";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
} from "../src/game-engine/runtime.js";

describe("GameSession の切断タイムアウトAlarm", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Alarm時点で操作担当者だけが未接続なら、接続中の相手を勝者にする", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T00:00:00.000Z"));

    const gameId = "disconnect-timeout-alarm";
    const session = getGameSession(gameId);
    await expect(
      session.initialize(createInitializeInput(gameId)),
    ).resolves.toEqual({ initialized: true });

    const initialSnapshot = await requireSnapshot(session, "player-1");
    const activePlayerId = initialSnapshot.view.firstPlayerId;
    const connectedPlayerId =
      activePlayerId === "player-1" ? "player-2" : "player-1";
    const phaseDeadlineAt = initialSnapshot.view.phaseDeadlineAt;
    if (phaseDeadlineAt === null) {
      throw new Error("進行中ゲームにはフェーズ期限が必要です。");
    }

    const connection = await session.fetch(
      new Request("https://example.test/events", {
        headers: {
          Upgrade: "websocket",
          "X-Disastar-Authenticated-Player-Id": connectedPlayerId,
        },
      }),
    );
    expect(connection.status).toBe(101);
    connection.webSocket?.accept();

    vi.setSystemTime(phaseDeadlineAt);
    await expect(
      runDurableObjectAlarm(session as unknown as DurableObjectStub),
    ).resolves.toBe(true);

    const result = await requireSnapshot(session, connectedPlayerId);
    expect(result.view).toMatchObject({
      status: "finished",
      phase: "finished",
      winner: {
        type: "player",
        playerId: connectedPlayerId,
        reason: "disconnectTimeout",
      },
    });
  });
});

type GameSessionRpc = {
  initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
  getSnapshot(
    viewerPlayerId: string,
    afterSequence?: number,
  ): Promise<GetGameSnapshotResult>;
  fetch(request: Request): Promise<Response>;
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
