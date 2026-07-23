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
import {
  getGameSessionRetentionExpiresAt,
  migrateAttackGroupSlots,
} from "../src/game-session/game-session.js";
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

  it("認証済み参加者へ更新通知用WebSocketを接続する", async () => {
    const gameId = "game-session-realtime";
    const stub = getGameSession(gameId);
    await stub.initialize(createInitializeInput(gameId));

    const response = await stub.fetch(
      new Request("http://example.com/events", {
        headers: {
          Upgrade: "websocket",
          "X-Disastar-Authenticated-Player-Id": "player-1",
        },
      }),
    );

    expect(response.status).toBe(101);
    const webSocket = response.webSocket;
    expect(webSocket).not.toBeNull();
    if (webSocket === null) {
      throw new Error("WebSocket接続を受け取れませんでした。");
    }
    webSocket.accept();
    const update = await new Promise<unknown>((resolve) => {
      webSocket.addEventListener("message", (event) => resolve(event.data));
    });
    expect(JSON.parse(String(update))).toEqual({
      type: "GAME_UPDATED",
      gameId,
      stateVersion: expect.any(Number),
      latestEventSequence: expect.any(Number),
    });

    const presenceAfterJoin = waitForWebSocketMessage(
      webSocket,
      (message) =>
        isPresenceMessage(message) &&
        message.onlinePlayerIds.length === 2 &&
        message.onlinePlayerIds.includes("player-2"),
    );
    const secondConnection = await stub.fetch(
      new Request("http://example.com/events", {
        headers: {
          Upgrade: "websocket",
          "X-Disastar-Authenticated-Player-Id": "player-2",
        },
      }),
    );
    secondConnection.webSocket?.accept();

    expect(await presenceAfterJoin).toEqual({
      type: "GAME_PRESENCE_UPDATED",
      gameId,
      onlinePlayerIds: ["player-1", "player-2"],
    });

    const snapshot = await stub.getSnapshot("player-1", 0);
    if (!snapshot.found) {
      throw new Error("接続後のゲーム状態を取得できませんでした。");
    }
    const playerId = snapshot.snapshot.view.firstPlayerId;
    const playerSnapshot = await stub.getSnapshot(playerId, 0);
    if (!playerSnapshot.found) {
      throw new Error("先手のゲーム状態を取得できませんでした。");
    }
    const nextUpdate = new Promise<unknown>((resolve) => {
      webSocket.addEventListener("message", (event) => resolve(event.data), {
        once: true,
      });
    });
    const submitted = await stub.submit({
      authenticatedPlayerId: playerId,
      receivedAt: 1_000,
      command: {
        type: "FINISH_PLACEMENT",
        commandId: "realtime-finish-placement",
        gameId,
        playerId,
        phaseSequence: playerSnapshot.snapshot.view.phaseSequence,
        clientStateVersion: playerSnapshot.snapshot.view.stateVersion,
        issuedAt: 1_000,
      },
    });

    expect(submitted).toMatchObject({
      submitted: true,
      response: { accepted: true },
    });
    expect(JSON.parse(String(await nextUpdate))).toMatchObject({
      type: "GAME_UPDATED",
      gameId,
      stateVersion: playerSnapshot.snapshot.view.stateVersion + 1,
    });
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

  it("旧保存形式の攻撃グループへ作成順の固定スロットを割り当てる", () => {
    const state = {
      players: {
        "player-1": {
          battlefield: {
            attackGroups: [{ groupId: "group-1" }, { groupId: "group-2" }],
          },
        },
      },
    } as unknown as Parameters<typeof migrateAttackGroupSlots>[0];

    expect(migrateAttackGroupSlots(state)).toBe(true);
    expect(
      state.players["player-1"]?.battlefield.attackGroups.map(
        (group) => group.slotIndex,
      ),
    ).toEqual([0, 1]);
    expect(migrateAttackGroupSlots(state)).toBe(false);
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
  fetch(request: Request): Promise<Response>;
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

type PresenceMessage = {
  type: "GAME_PRESENCE_UPDATED";
  gameId: string;
  onlinePlayerIds: string[];
};

function waitForWebSocketMessage(
  webSocket: WebSocket,
  matches: (message: unknown) => boolean,
): Promise<unknown> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as unknown;
      if (matches(message)) {
        webSocket.removeEventListener("message", listener);
        resolve(message);
      }
    };
    webSocket.addEventListener("message", listener);
  });
}

function isPresenceMessage(value: unknown): value is PresenceMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "GAME_PRESENCE_UPDATED" &&
    "onlinePlayerIds" in value &&
    Array.isArray(value.onlinePlayerIds)
  );
}
