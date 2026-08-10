import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  AuthenticatedGameCommand,
  GameRealtimeMessage,
} from "@disastar/contracts/game";
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

describe("GameSession の並行実行と状態復元", () => {
  it("同じ状態から異なる操作を並行送信しても、一方だけを直列に確定する", async () => {
    const gameId = "game-session-concurrent-conflict";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const playerId = initial.view.firstPlayerId;
    const firstCommand = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "concurrent-first-finish-placement",
    });
    const secondCommand = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "concurrent-second-finish-placement",
    });

    const results = await Promise.all([
      session.submit(createAuthenticatedCommand(playerId, firstCommand)),
      session.submit(createAuthenticatedCommand(playerId, secondCommand)),
    ]);

    const accepted = results.find(
      (result) => result.submitted && result.response.accepted,
    );
    const rejected = results.find(
      (result) =>
        result.submitted &&
        !result.response.accepted &&
        result.response.error.code === "PHASE_SEQUENCE_MISMATCH",
    );
    expect(accepted).toMatchObject({
      submitted: true,
      response: { accepted: true },
    });
    expect(rejected).toMatchObject({
      submitted: true,
      response: {
        accepted: false,
        error: { code: "PHASE_SEQUENCE_MISMATCH" },
      },
    });

    const after = await requireSnapshot(session, playerId);
    expect(after.view).toMatchObject({
      phase: "secondPlayerPlacement",
      stateVersion: initial.view.stateVersion + 1,
    });
    expect(after.latestEventSequence).toBeGreaterThan(
      initial.latestEventSequence,
    );
  });

  it("同じ操作を並行送信しても、一度だけ状態を進めて同じ確定結果を返す", async () => {
    const gameId = "game-session-concurrent-retry";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const playerId = initial.view.firstPlayerId;
    const command = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "concurrent-finish-placement",
    });
    const authenticatedCommand = createAuthenticatedCommand(playerId, command);

    const [first, retried] = await Promise.all([
      session.submit(authenticatedCommand),
      session.submit(authenticatedCommand),
    ]);

    expect(first).toEqual(retried);
    expect(first).toMatchObject({
      submitted: true,
      response: {
        accepted: true,
        commandId: command.commandId,
        view: {
          phase: "secondPlayerPlacement",
          stateVersion: initial.view.stateVersion + 1,
        },
      },
    });

    const after = await requireSnapshot(session, playerId);
    expect(after.view).toMatchObject({
      phase: "secondPlayerPlacement",
      stateVersion: initial.view.stateVersion + 1,
    });
  });

  it("外部同期待機中に状態が進んでも最新フェーズのAlarmを維持する", async () => {
    const gameId = "game-session-latest-alarm-wins";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const firstPlayerId = initial.view.firstPlayerId;
    await session.submit(
      createAuthenticatedCommand(
        firstPlayerId,
        createFinishPlacementCommand({
          gameId,
          playerId: firstPlayerId,
          phaseSequence: initial.view.phaseSequence,
          clientStateVersion: initial.view.stateVersion,
          commandId: "latest-alarm-first-placement",
        }),
      ),
    );

    const secondPlacement = await requireSnapshot(
      session,
      initial.view.secondPlayerId,
    );
    const staleSession = await cloneStoredSession(session);
    const secondPlayerId = secondPlacement.view.viewerPlayerId;
    await session.submit(
      createAuthenticatedCommand(
        secondPlayerId,
        createFinishPlacementCommand({
          gameId,
          playerId: secondPlayerId,
          phaseSequence: secondPlacement.view.phaseSequence,
          clientStateVersion: secondPlacement.view.stateVersion,
          commandId: "latest-alarm-second-placement",
        }),
      ),
    );

    const support = await requireSnapshot(session, secondPlayerId);
    expect(support.view.phase).toBe("support");
    expect(support.view.phaseDeadlineAt).not.toBeNull();

    await syncAlarmWithStoredSession(session, staleSession);

    expect(await getStoredAlarm(session)).toBe(support.view.phaseDeadlineAt);
  });

  it("保存後に外部同期が失敗しても、同じcommandIdの再送でカタログ保持とAlarmを復旧する", async () => {
    const gameId = "game-session-command-infrastructure-recovery";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const playerId = initial.view.firstPlayerId;
    const observingSocket = await openGameSocket(
      session,
      initial.view.secondPlayerId,
    );
    const command = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "recover-infrastructure-after-command",
    });
    const authenticatedCommand = createAuthenticatedCommand(playerId, command);

    await failNextSessionInfrastructureSync(
      session,
      "syncSessionAlarm",
      "simulated session alarm sync failure",
    );
    expect(await captureSubmitFailure(session, authenticatedCommand)).toBe(
      "simulated session alarm sync failure",
    );

    const committed = await requireSnapshot(session, playerId);
    expect(committed.view).toMatchObject({
      phase: "secondPlayerPlacement",
      stateVersion: initial.view.stateVersion + 1,
    });
    if (committed.view.phaseDeadlineAt === null) {
      throw new Error("進行中ゲームにはフェーズ期限が必要です。");
    }

    const catalogArchive = getCatalogArchive();
    await removeCatalogLease(
      catalogArchive,
      committed.view.cardCatalogVersion,
      gameId,
    );
    await deleteStoredAlarm(session);
    await evictDurableObject(session as unknown as DurableObjectStub);

    const recoveryUpdate = waitForGameUpdate(
      observingSocket,
      committed.view.stateVersion,
    );

    const retried = await session.submit(authenticatedCommand);
    expect(retried).toMatchObject({
      submitted: true,
      response: {
        accepted: true,
        commandId: command.commandId,
        view: {
          phase: "secondPlayerPlacement",
          stateVersion: initial.view.stateVersion + 1,
        },
      },
    });
    expect(await getStoredAlarm(session)).toBe(committed.view.phaseDeadlineAt);
    expect(
      await getCatalogLease(
        catalogArchive,
        committed.view.cardCatalogVersion,
        gameId,
      ),
    ).toBeNull();

    const afterRetry = await requireSnapshot(session, playerId);
    expect(afterRetry.view.stateVersion).toBe(committed.view.stateVersion);
    expect(afterRetry.events).toEqual(committed.events);
    await expect(recoveryUpdate).resolves.toMatchObject({
      gameId,
      stateVersion: committed.view.stateVersion,
    });
    observingSocket.close(1000, "recovery test complete");
  });

  it("保存済みcommandIdの再送ではフルカタログ登録を繰り返さない", async () => {
    const gameId = "game-session-lightweight-catalog-renewal";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const playerId = initial.view.firstPlayerId;
    const command = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "lightweight-catalog-renewal-command",
    });
    const authenticatedCommand = createAuthenticatedCommand(playerId, command);

    await expect(session.submit(authenticatedCommand)).resolves.toMatchObject({
      submitted: true,
      response: { accepted: true },
    });
    const catalogArchive = getCatalogArchive();
    const originalCatalog = await replaceCatalogWithConflictingContent(
      catalogArchive,
      initial.view.cardCatalogVersion,
    );
    try {
      await expect(session.submit(authenticatedCommand)).resolves.toMatchObject(
        {
          submitted: true,
          response: {
            accepted: true,
            commandId: command.commandId,
          },
        },
      );
    } finally {
      await restoreCatalogContent(
        catalogArchive,
        initial.view.cardCatalogVersion,
        originalCatalog,
      );
    }
  });

  it("同じ初期化入力の再送でもカタログ内容の競合を検証する", async () => {
    const gameId = "game-session-catalog-conflict-retry";
    const session = getGameSession(gameId);
    const input = createInitializeInput(gameId);
    await initialize(session, gameId);
    const snapshot = await requireSnapshot(session, "player-1");
    const catalogArchive = getCatalogArchive();
    const originalCatalog = await replaceCatalogWithConflictingContent(
      catalogArchive,
      snapshot.view.cardCatalogVersion,
    );

    try {
      await runInDurableObject(
        session as unknown as DurableObjectStub,
        async (instance) => {
          await expect(
            (instance as unknown as GameSessionInternals).initialize(input),
          ).rejects.toThrow("CARD_CATALOG_VERSION_CONFLICT");
        },
      );
    } finally {
      await restoreCatalogContent(
        catalogArchive,
        snapshot.view.cardCatalogVersion,
        originalCatalog,
      );
    }
  });

  it("終了状態の保存後に外部同期が失敗しても、Alarm再試行で同じ保持期限を復旧する", async () => {
    const gameId = "game-session-alarm-infrastructure-recovery";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const observingSocket = await openGameSocket(
      session,
      initial.view.secondPlayerId,
    );
    await setPhaseDeadlineToNow(session);
    await failNextSessionInfrastructureSync(
      session,
      "syncCatalogRetention",
      "simulated catalog retention sync failure",
    );

    expect(await captureSessionAlarmFailure(session)).toBe(
      "simulated catalog retention sync failure",
    );

    const committed = await requireSnapshot(session, "player-1");
    expect(committed.view.status).toBe("finished");
    expect(committed.view.stateVersion).toBe(initial.view.stateVersion + 1);
    const retentionExpiresAt = await getRetentionExpiresAt(session);
    if (retentionExpiresAt === null) {
      throw new Error("終了済みゲームには保持期限が必要です。");
    }

    const catalogArchive = getCatalogArchive();
    expect(
      await getCatalogLease(
        catalogArchive,
        committed.view.cardCatalogVersion,
        gameId,
      ),
    ).toBeNull();
    await deleteStoredAlarm(session);
    await evictDurableObject(session as unknown as DurableObjectStub);

    const recoveryUpdate = waitForGameUpdate(
      observingSocket,
      committed.view.stateVersion,
    );

    await invokeSessionAlarm(session);

    expect(await getStoredAlarm(session)).toBe(retentionExpiresAt);
    expect(
      await getCatalogLease(
        catalogArchive,
        committed.view.cardCatalogVersion,
        gameId,
      ),
    ).toBe(retentionExpiresAt);

    const afterRetry = await requireSnapshot(session, "player-1");
    expect(afterRetry.view.stateVersion).toBe(committed.view.stateVersion);
    expect(afterRetry.events).toEqual(committed.events);
    await expect(recoveryUpdate).resolves.toMatchObject({
      gameId,
      stateVersion: committed.view.stateVersion,
    });
    observingSocket.close(1000, "recovery test complete");
  });

  it("期限ちょうどの通常操作とAlarmが競合しても、直列化された結果だけを確定する", async () => {
    const gameId = "game-session-deadline-race";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const playerId = initial.view.firstPlayerId;
    const phaseDeadlineAt = await setPhaseDeadlineToNow(session);
    const command = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "finish-placement-at-deadline",
    });

    const [submitted, alarmRan] = await Promise.all([
      session.submit({
        ...createAuthenticatedCommand(playerId, command),
        receivedAt: phaseDeadlineAt,
      }),
      runDurableObjectAlarm(session as unknown as DurableObjectStub),
    ]);

    expect(alarmRan).toBe(true);
    expect(submitted.submitted).toBe(true);
    if (!submitted.submitted) {
      throw new Error("通常操作の送信結果を取得できませんでした。");
    }

    const after = await requireSnapshot(session, playerId);
    if (submitted.response.accepted) {
      expect(after.view).toMatchObject({
        status: "active",
        phase: "secondPlayerPlacement",
      });
    } else {
      expect(submitted.response.error.code).toBe("GAME_NOT_ACTIVE");
      expect(after.view.status).toBe("finished");
    }
    expect(after.latestEventSequence).toBe(after.events.at(-1)?.sequence);
    expect(new Set(after.events.map((event) => event.sequence)).size).toBe(
      after.events.length,
    );
    expect(after.view.stateVersion).toBe(initial.view.stateVersion + 1);
  });

  it("eviction後も受理・拒否結果、イベント連番、固定済みカタログを復元する", async () => {
    const gameId = "game-session-eviction-recovery";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const initial = await requireSnapshot(session, "player-1");
    const playerId = initial.view.firstPlayerId;
    const deferredPlayerId = initial.view.secondPlayerId;
    const rejectedCommand = createFinishPlacementCommand({
      gameId,
      playerId: deferredPlayerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "rejected-before-eviction",
    });
    const rejected = await session.submit(
      createAuthenticatedCommand(deferredPlayerId, rejectedCommand),
    );
    expect(rejected).toMatchObject({
      submitted: true,
      response: { accepted: false, error: { code: "NOT_CURRENT_PLAYER" } },
    });

    const acceptedCommand = createFinishPlacementCommand({
      gameId,
      playerId,
      phaseSequence: initial.view.phaseSequence,
      clientStateVersion: initial.view.stateVersion,
      commandId: "accepted-before-eviction",
    });
    const accepted = await session.submit(
      createAuthenticatedCommand(playerId, acceptedCommand),
    );
    expect(accepted).toMatchObject({
      submitted: true,
      response: { accepted: true },
    });

    const afterAccepted = await requireSnapshot(session, playerId);

    await evictDurableObject(session as unknown as DurableObjectStub);

    const recovered = await requireSnapshot(session, playerId);
    expect(recovered.view).toEqual(afterAccepted.view);
    expect(recovered.latestEventSequence).toBe(
      afterAccepted.latestEventSequence,
    );
    expect(recovered.events).toEqual(afterAccepted.events);
    expect(recovered.view.cardCatalogVersion).toBe(
      afterAccepted.view.cardCatalogVersion,
    );

    await expect(
      session.submit(createAuthenticatedCommand(playerId, acceptedCommand)),
    ).resolves.toEqual(accepted);
    await expect(
      session.submit(
        createAuthenticatedCommand(deferredPlayerId, rejectedCommand),
      ),
    ).resolves.toEqual(rejected);
    await expect(session.getSnapshot(playerId, 0)).resolves.toEqual({
      found: true,
      snapshot: recovered,
    });
  });

  it("イベント差分を連続・重複・欠落・最新値より大きい連番で取得できる", async () => {
    const gameId = "game-session-event-sequence-recovery";
    const session = getGameSession(gameId);
    await initialize(session, gameId);

    const complete = await requireSnapshot(session, "player-1");
    expect(complete.events.length).toBeGreaterThanOrEqual(2);
    const latestSequence = complete.latestEventSequence;
    const afterLatest = await requireSnapshot(
      session,
      "player-1",
      latestSequence,
    );
    const repeatedAfterLatest = await requireSnapshot(
      session,
      "player-1",
      latestSequence,
    );
    const fromOneEventBehind = await requireSnapshot(
      session,
      "player-1",
      latestSequence - 1,
    );
    const afterMissingEvents = await requireSnapshot(session, "player-1", 1);
    const afterFutureSequence = await requireSnapshot(
      session,
      "player-1",
      latestSequence + 10,
    );

    expect(afterLatest.events).toEqual([]);
    expect(repeatedAfterLatest).toEqual(afterLatest);
    expect(fromOneEventBehind.events).toHaveLength(1);
    expect(fromOneEventBehind.events[0]?.sequence).toBe(latestSequence);
    expect(afterMissingEvents.events).toEqual(
      complete.events.filter((event) => event.sequence > 1),
    );
    expect(afterFutureSequence).toMatchObject({
      events: [],
      latestEventSequence: latestSequence,
    });
  });
});

type GameSessionRpc = {
  fetch(request: Request): Promise<Response>;
  initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
  getSnapshot(
    viewerPlayerId: string,
    afterSequence?: number,
  ): Promise<GetGameSnapshotResult>;
  submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResult>;
};

type CatalogArchiveRpc = {
  getCatalog(version: string): Promise<unknown>;
};

type SessionInfrastructureMethod = "syncCatalogRetention" | "syncSessionAlarm";

type GameSessionInternals = {
  session: {
    retentionExpiresAt?: number | null;
    state: { phaseDeadlineAt: number | null };
  } | null;
  alarm(): Promise<void>;
  initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
  submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResult>;
  syncCatalogRetention(session: unknown): Promise<void>;
  syncSessionAlarm(session: unknown): Promise<void>;
};

type CatalogArchiveInternals = {
  archive: {
    entries: Record<
      string,
      { catalog: unknown; leases: Record<string, number | null> } | undefined
    >;
  };
};

function getGameSession(gameId: string): GameSessionRpc {
  const gameSessions = env.GAME_SESSION as unknown as {
    getByName(name: string): GameSessionRpc;
  };
  return gameSessions.getByName(gameId);
}

function getCatalogArchive(): CatalogArchiveRpc {
  const catalogArchive = env.CATALOG_ARCHIVE as unknown as {
    getByName(name: string): CatalogArchiveRpc;
  };
  return catalogArchive.getByName("card-catalog-retention");
}

async function initialize(
  session: GameSessionRpc,
  gameId: string,
): Promise<void> {
  await expect(
    session.initialize(createInitializeInput(gameId)),
  ).resolves.toEqual({
    initialized: true,
  });
}

async function requireSnapshot(
  session: GameSessionRpc,
  playerId: string,
  afterSequence = 0,
) {
  const result = await session.getSnapshot(playerId, afterSequence);
  if (!result.found) {
    throw new Error(
      `プレイヤー ${playerId} のスナップショットを取得できませんでした。`,
    );
  }
  return result.snapshot;
}

function createAuthenticatedCommand(
  playerId: string,
  command: GameCommand,
): AuthenticatedGameCommand {
  return {
    authenticatedPlayerId: playerId,
    receivedAt: Date.now(),
    command,
  };
}

async function setPhaseDeadlineToNow(session: GameSessionRpc): Promise<number> {
  return runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance, state) => {
      const internals = instance as unknown as {
        session: { state: { phaseDeadlineAt: number | null } } | null;
      };
      if (internals.session === null) {
        throw new Error("初期化済みゲームセッションが見つかりません。");
      }

      const phaseDeadlineAt = Date.now();
      internals.session.state.phaseDeadlineAt = phaseDeadlineAt;
      await state.storage.put("game-session-v2-factions", internals.session);
      await state.storage.setAlarm(phaseDeadlineAt + 60_000);
      return phaseDeadlineAt;
    },
  );
}

async function failNextSessionInfrastructureSync(
  session: GameSessionRpc,
  method: SessionInfrastructureMethod,
  message: string,
): Promise<void> {
  await runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      const internals = instance as unknown as GameSessionInternals;
      const original = internals[method].bind(internals);
      let shouldFail = true;
      internals[method] = async (storedSession: unknown) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error(message);
        }
        await original(storedSession);
      };
    },
  );
}

async function invokeSessionAlarm(session: GameSessionRpc): Promise<void> {
  await runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      await (instance as unknown as GameSessionInternals).alarm();
    },
  );
}

async function captureSubmitFailure(
  session: GameSessionRpc,
  authenticatedCommand: AuthenticatedGameCommand,
): Promise<string> {
  return runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      try {
        await (instance as unknown as GameSessionInternals).submit(
          authenticatedCommand,
        );
      } catch (error) {
        return getErrorMessage(error);
      }
      throw new Error("GameSession.submitが失敗しませんでした。");
    },
  );
}

async function captureSessionAlarmFailure(
  session: GameSessionRpc,
): Promise<string> {
  return runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      try {
        await (instance as unknown as GameSessionInternals).alarm();
      } catch (error) {
        return getErrorMessage(error);
      }
      throw new Error("GameSession.alarmが失敗しませんでした。");
    },
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function deleteStoredAlarm(session: GameSessionRpc): Promise<void> {
  await runInDurableObject(
    session as unknown as DurableObjectStub,
    async (_instance, state) => {
      await state.storage.deleteAlarm();
    },
  );
}

async function getStoredAlarm(session: GameSessionRpc): Promise<number | null> {
  return runInDurableObject(
    session as unknown as DurableObjectStub,
    async (_instance, state) => state.storage.getAlarm(),
  );
}

async function getRetentionExpiresAt(
  session: GameSessionRpc,
): Promise<number | null> {
  return runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      const storedSession = (instance as unknown as GameSessionInternals)
        .session;
      return storedSession?.retentionExpiresAt ?? null;
    },
  );
}

async function cloneStoredSession(session: GameSessionRpc): Promise<unknown> {
  return runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      const storedSession = (instance as unknown as GameSessionInternals)
        .session;
      if (storedSession === null) {
        throw new Error("初期化済みゲームセッションが見つかりません。");
      }
      return structuredClone(storedSession);
    },
  );
}

async function syncAlarmWithStoredSession(
  session: GameSessionRpc,
  storedSession: unknown,
): Promise<void> {
  await runInDurableObject(
    session as unknown as DurableObjectStub,
    async (instance) => {
      await (instance as unknown as GameSessionInternals).syncSessionAlarm(
        storedSession,
      );
    },
  );
}

async function removeCatalogLease(
  catalogArchive: CatalogArchiveRpc,
  version: string,
  gameId: string,
): Promise<void> {
  await catalogArchive.getCatalog(version);
  await runInDurableObject(
    catalogArchive as unknown as DurableObjectStub,
    async (instance, state) => {
      const archive = (instance as unknown as CatalogArchiveInternals).archive;
      const entry = archive.entries[version];
      if (entry === undefined) {
        throw new Error(`カードカタログ ${version} が見つかりません。`);
      }
      delete entry.leases[gameId];
      await state.storage.put("catalog-archive-v1", archive);
    },
  );
}

async function getCatalogLease(
  catalogArchive: CatalogArchiveRpc,
  version: string,
  gameId: string,
): Promise<number | null | undefined> {
  await catalogArchive.getCatalog(version);
  return runInDurableObject(
    catalogArchive as unknown as DurableObjectStub,
    async (instance) => {
      const archive = (instance as unknown as CatalogArchiveInternals).archive;
      return archive.entries[version]?.leases[gameId];
    },
  );
}

async function replaceCatalogWithConflictingContent(
  catalogArchive: CatalogArchiveRpc,
  version: string,
): Promise<unknown> {
  await catalogArchive.getCatalog(version);
  return runInDurableObject(
    catalogArchive as unknown as DurableObjectStub,
    async (instance, state) => {
      const archive = (instance as unknown as CatalogArchiveInternals).archive;
      const entry = archive.entries[version];
      if (entry === undefined) {
        throw new Error(`カードカタログ ${version} が見つかりません。`);
      }
      const originalCatalog = structuredClone(entry.catalog);
      const catalog = entry.catalog as {
        definitions: Record<string, { name?: string } | undefined>;
      };
      const firstDefinition = Object.values(catalog.definitions)[0];
      if (firstDefinition === undefined) {
        throw new Error("競合テスト用のカード定義が見つかりません。");
      }
      firstDefinition.name = "conflicting catalog content";
      await state.storage.put("catalog-archive-v1", archive);
      return originalCatalog;
    },
  );
}

async function restoreCatalogContent(
  catalogArchive: CatalogArchiveRpc,
  version: string,
  catalog: unknown,
): Promise<void> {
  await runInDurableObject(
    catalogArchive as unknown as DurableObjectStub,
    async (instance, state) => {
      const archive = (instance as unknown as CatalogArchiveInternals).archive;
      const entry = archive.entries[version];
      if (entry === undefined) {
        throw new Error(`カードカタログ ${version} が見つかりません。`);
      }
      entry.catalog = catalog;
      await state.storage.put("catalog-archive-v1", archive);
    },
  );
}

async function openGameSocket(
  session: GameSessionRpc,
  playerId: string,
): Promise<WebSocket> {
  const response = await session.fetch(
    new Request("https://example.test/events", {
      headers: {
        Upgrade: "websocket",
        "X-Disastar-Authenticated-Player-Id": playerId,
      },
    }),
  );
  if (response.status !== 101 || response.webSocket === null) {
    throw new Error("ゲーム更新WebSocketへ接続できませんでした。");
  }

  const webSocket = response.webSocket;
  webSocket.accept();
  await waitForGameUpdate(webSocket);
  return webSocket;
}

function waitForGameUpdate(
  webSocket: WebSocket,
  stateVersion?: number,
): Promise<Extract<GameRealtimeMessage, { type: "GAME_UPDATED" }>> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as GameRealtimeMessage;
      if (
        message.type === "GAME_UPDATED" &&
        (stateVersion === undefined || message.stateVersion >= stateVersion)
      ) {
        webSocket.removeEventListener("message", listener);
        resolve(message);
      }
    };
    webSocket.addEventListener("message", listener);
  });
}

function createFinishPlacementCommand({
  gameId,
  playerId,
  phaseSequence,
  clientStateVersion,
  commandId,
}: {
  gameId: string;
  playerId: string;
  phaseSequence: number;
  clientStateVersion: number;
  commandId: string;
}): GameCommand {
  return {
    type: "FINISH_PLACEMENT",
    commandId,
    gameId,
    playerId,
    phaseSequence,
    clientStateVersion,
    issuedAt: 0,
  };
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
