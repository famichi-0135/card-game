import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  AuthenticatedGameCommand,
  GameSnapshotResponse,
} from "@disastar/contracts/game";
import type { InitializeGameInput } from "@disastar/game-engine/contracts";
import type {
  GetGameSnapshotResult,
  SubmitGameCommandResult,
} from "../src/game-session/game-session.js";
import { getGameSessionRetentionExpiresAt } from "../src/game-session/game-session.js";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
  gameEngineContext,
} from "../src/game-engine/runtime.js";
import { GAME_RECONNECT_GRACE_PERIOD_MS } from "../src/catalog-archive/catalog-archive.js";
import { cloneCardCatalog } from "../src/catalog-archive/catalog-archive.js";

describe("GameSession Durable Object", () => {
  it("ゲーム状態とイベントを保存し、閲覧者別のスナップショットを返す", async () => {
    const stub = getGameSession("game-session-snapshot");
    const initialized = await stub.initialize(createInitializeInput());

    expect(initialized).toEqual({ initialized: true });

    const playerOneSnapshotResult = await stub.getSnapshot("player-1", 0);
    const playerTwoSnapshotResult = await stub.getSnapshot("player-2", 0);
    expect(playerOneSnapshotResult).toMatchObject({ found: true });
    expect(playerTwoSnapshotResult).toMatchObject({ found: true });
    if (!playerOneSnapshotResult.found || !playerTwoSnapshotResult.found) {
      throw new Error("参加者のスナップショットを取得できませんでした。");
    }
    const playerOneSnapshot = playerOneSnapshotResult.snapshot;
    const playerTwoSnapshot = playerTwoSnapshotResult.snapshot;

    expect(playerOneSnapshot.view.viewerPlayerId).toBe("player-1");
    expect(playerOneSnapshot.view.self.hand.length).toBeGreaterThan(0);
    expect(playerOneSnapshot.view.opponent).not.toHaveProperty("hand");
    expect(playerTwoSnapshot.view.viewerPlayerId).toBe("player-2");
    expect(playerOneSnapshot.events.length).toBeGreaterThan(3);
    expect(playerTwoSnapshot.events).toHaveLength(
      playerOneSnapshot.events.length,
    );
    expect(playerOneSnapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "CARDS_DRAWN",
            playerId: "player-1",
            cardInstanceIds: expect.any(Array),
          }),
        }),
      ]),
    );
    expect(playerTwoSnapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "CARDS_DRAWN",
            playerId: "player-1",
            count: expect.any(Number),
          }),
        }),
      ]),
    );
  });

  it("初期化時のカードカタログをアーカイブへ無期限リースする", async () => {
    const gameId = "game-session-catalog-retention";
    const stub = getGameSession(gameId);

    await expect(
      stub.initialize(createInitializeInput(gameId)),
    ).resolves.toEqual({
      initialized: true,
    });

    const catalogs = env.CATALOG_ARCHIVE as unknown as {
      getByName(name: string): {
        getCatalog(version: string): Promise<unknown>;
      };
    };
    await expect(
      catalogs
        .getByName("card-catalog-retention")
        .getCatalog(gameEngineContext.cardCatalog.version),
    ).resolves.toEqual(cloneCardCatalog(gameEngineContext.cardCatalog));
  });

  it("終了したゲームの再接続猶予を24時間に固定する", () => {
    const finishedAt = 1_000;

    expect(
      getGameSessionRetentionExpiresAt({
        status: "active",
        phaseStartedAt: finishedAt,
      }),
    ).toBeNull();
    expect(
      getGameSessionRetentionExpiresAt({
        status: "finished",
        phaseStartedAt: finishedAt,
      }),
    ).toBe(finishedAt + GAME_RECONNECT_GRACE_PERIOD_MS);
  });

  it("同じ commandId の再送には最初の結果を返す", async () => {
    const gameId = "game-session-idempotency";
    const stub = getGameSession(gameId);
    await stub.initialize(createInitializeInput(gameId));

    const initialSnapshotResult = await stub.getSnapshot("player-1", 0);
    if (!initialSnapshotResult.found) {
      throw new Error("初期スナップショットを取得できませんでした。");
    }
    const initialSnapshot = initialSnapshotResult.snapshot;
    const currentPlayerId = initialSnapshot.view.firstPlayerId;
    const currentSnapshotResult = await stub.getSnapshot(currentPlayerId, 0);
    if (!currentSnapshotResult.found) {
      throw new Error(
        "現在プレイヤーのスナップショットを取得できませんでした。",
      );
    }
    const currentSnapshot = currentSnapshotResult.snapshot;
    const command: AuthenticatedGameCommand = {
      authenticatedPlayerId: currentPlayerId,
      receivedAt: Date.now(),
      command: {
        type: "FINISH_PLACEMENT",
        commandId: "finish-placement-once",
        gameId,
        playerId: currentPlayerId,
        phaseSequence: currentSnapshot.view.phaseSequence,
        clientStateVersion: currentSnapshot.view.stateVersion,
        issuedAt: 0,
      },
    };

    const firstResult = await stub.submit(command);
    const retriedResult = await stub.submit(command);

    expect(firstResult).toMatchObject({ submitted: true });
    if (!firstResult.submitted) {
      throw new Error("コマンドが送信されませんでした。");
    }
    expect(firstResult.response).toMatchObject({
      accepted: true,
      commandId: command.command.commandId,
      view: { phase: "secondPlayerPlacement" },
    });
    expect(retriedResult).toEqual(firstResult);

    const snapshotResult = await stub.getSnapshot(currentPlayerId, 0);
    if (!snapshotResult.found || !firstResult.response.accepted) {
      throw new Error("コマンド後のスナップショットを取得できませんでした。");
    }
    const snapshot = snapshotResult.snapshot as GameSnapshotResponse;
    expect(snapshot.view.stateVersion).toBe(
      firstResult.response.view.stateVersion,
    );
  });

  it("別プレイヤーが同じcommandIdを再利用しても保存済み結果を返さない", async () => {
    const gameId = "game-session-command-id-owner";
    const stub = getGameSession(gameId);
    await stub.initialize(createInitializeInput(gameId));
    const initial = await stub.getSnapshot("player-1", 0);
    if (!initial.found) {
      throw new Error("初期スナップショットを取得できませんでした。");
    }
    const firstPlayerId = initial.snapshot.view.firstPlayerId;
    const secondPlayerId = initial.snapshot.view.secondPlayerId;
    const firstCommand: AuthenticatedGameCommand = {
      authenticatedPlayerId: firstPlayerId,
      receivedAt: Date.now(),
      command: {
        type: "FINISH_PLACEMENT",
        commandId: "shared-command-id",
        gameId,
        playerId: firstPlayerId,
        phaseSequence: initial.snapshot.view.phaseSequence,
        clientStateVersion: initial.snapshot.view.stateVersion,
        issuedAt: 0,
      },
    };
    const first = await stub.submit(firstCommand);
    expect(first).toMatchObject({ submitted: true });
    await expect(
      stub.submit({
        ...firstCommand,
        command: { ...firstCommand.command, issuedAt: 1 },
      }),
    ).resolves.toEqual({
      submitted: false,
      error: { code: "COMMAND_ID_CONFLICT" },
    });

    const current = await stub.getSnapshot(secondPlayerId, 0);
    if (!current.found) {
      throw new Error("第2プレイヤーの状態を取得できませんでした。");
    }
    await expect(
      stub.submit({
        authenticatedPlayerId: secondPlayerId,
        receivedAt: Date.now(),
        command: {
          type: "FINISH_PLACEMENT",
          commandId: "shared-command-id",
          gameId,
          playerId: secondPlayerId,
          phaseSequence: current.snapshot.view.phaseSequence,
          clientStateVersion: current.snapshot.view.stateVersion,
          issuedAt: 0,
        },
      }),
    ).resolves.toEqual({
      submitted: false,
      error: { code: "COMMAND_ID_CONFLICT" },
    });
  });

  it("同一の初期化入力は再送として受理し、異なる入力では再初期化しない", async () => {
    const gameId = "game-session-initialize-idempotency";
    const stub = getGameSession(gameId);
    const input = createInitializeInput(gameId);

    await expect(stub.initialize(input)).resolves.toEqual({
      initialized: true,
    });
    const initialSnapshotResult = await stub.getSnapshot("player-1", 0);
    if (!initialSnapshotResult.found) {
      throw new Error("初期スナップショットを取得できませんでした。");
    }
    const initialSnapshot = initialSnapshotResult.snapshot;

    await runInDurableObject(
      stub as unknown as DurableObjectStub,
      async (_instance, state) => {
        await state.storage.deleteAlarm();
        expect(await state.storage.getAlarm()).toBeNull();
      },
    );

    await expect(stub.initialize(input)).resolves.toEqual({
      initialized: true,
    });
    await runInDurableObject(
      stub as unknown as DurableObjectStub,
      async (_instance, state) => {
        expect(await state.storage.getAlarm()).toBe(
          initialSnapshot.view.phaseDeadlineAt,
        );
      },
    );
    await expect(
      stub.initialize({ ...input, randomSeed: "different-seed" }),
    ).resolves.toMatchObject({ initialized: false });

    const retriedSnapshotResult = await stub.getSnapshot("player-1", 0);
    if (!retriedSnapshotResult.found) {
      throw new Error("再送後のスナップショットを取得できませんでした。");
    }
    expect(retriedSnapshotResult.snapshot).toEqual(initialSnapshot);
  });

  it("未初期化セッションと参加者外アクセスを安定した結果で拒否する", async () => {
    const missing = getGameSession("game-session-missing");
    await expect(missing.getSnapshot("player-1", 0)).resolves.toEqual({
      found: false,
      error: { code: "GAME_NOT_FOUND" },
    });

    const gameId = "game-session-access";
    const initialized = getGameSession(gameId);
    await initialized.initialize(createInitializeInput(gameId));
    await expect(initialized.getSnapshot("player-3", 0)).resolves.toEqual({
      found: false,
      error: { code: "GAME_ACCESS_FORBIDDEN" },
    });
    await expect(
      initialized.submit({
        authenticatedPlayerId: "player-3",
        receivedAt: 1_000,
        command: {
          type: "FINISH_PLACEMENT",
          commandId: "forbidden-command",
          gameId,
          playerId: "player-3",
          phaseSequence: 1,
          clientStateVersion: 1,
          issuedAt: 1_000,
        },
      }),
    ).resolves.toEqual({
      submitted: false,
      error: { code: "GAME_ACCESS_FORBIDDEN" },
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

function createInitializeInput(
  gameId = "game-session-snapshot",
): InitializeGameInput {
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
