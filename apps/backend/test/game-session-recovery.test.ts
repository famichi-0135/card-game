import { env, evictDurableObject } from "cloudflare:test";
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
