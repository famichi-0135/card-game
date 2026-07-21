import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  AuthenticatedGameCommand,
  GameSnapshotResponse,
  SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import type { InitializeGameInput } from "@disastar/game-engine/contracts";

describe("GameSession Durable Object", () => {
  it("ゲーム状態とイベントを保存し、閲覧者別のスナップショットを返す", async () => {
    const stub = getGameSession("game-session-snapshot");
    const initialized = await stub.initialize(createInitializeInput());

    expect(initialized).toEqual({ initialized: true });

    const playerOneSnapshot = await stub.getSnapshot("player-1", 0);
    const playerTwoSnapshot = await stub.getSnapshot("player-2", 0);

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

  it("同じ commandId の再送には最初の結果を返す", async () => {
    const gameId = "game-session-idempotency";
    const stub = getGameSession(gameId);
    await stub.initialize(createInitializeInput(gameId));

    const initialSnapshot = await stub.getSnapshot("player-1", 0);
    const currentPlayerId = initialSnapshot.view.firstPlayerId;
    const currentSnapshot = await stub.getSnapshot(currentPlayerId, 0);
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

    expect(firstResult).toMatchObject({
      accepted: true,
      commandId: command.command.commandId,
      view: { phase: "secondPlayerPlacement" },
    });
    expect(retriedResult).toEqual(firstResult);

    const snapshot = (await stub.getSnapshot(
      currentPlayerId,
      0,
    )) as GameSnapshotResponse;
    expect(snapshot.view.stateVersion).toBe(firstResult.view.stateVersion);
  });
});

type GameSessionRpc = {
  initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
  getSnapshot(
    viewerPlayerId: string,
    afterSequence?: number,
  ): Promise<GameSnapshotResponse>;
  submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResponse>;
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
  const deckDefinitionIds = createDeckDefinitionIds();
  return {
    gameId,
    randomSeed: `${gameId}-seed`,
    players: [
      { playerId: "player-1", deckDefinitionIds },
      { playerId: "player-2", deckDefinitionIds: [...deckDefinitionIds] },
    ],
  };
}

function createDeckDefinitionIds(): string[] {
  return [
    "mana-a",
    "mana-a",
    "mana-a",
    "mana-b",
    "mana-b",
    "mana-b",
    "mana-c",
    "mana-c",
    "attack-1",
    "attack-1",
    ...Array.from({ length: 10 }, (_, index) => [
      `attack-${index + 2}`,
      `attack-${index + 2}`,
    ]).flat(),
  ];
}
