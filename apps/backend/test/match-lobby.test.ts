import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  CardDefinitionId,
  Faction,
  InitializeGameInput,
} from "@disastar/game-engine/contracts";
import { initializeGameSessionInEnvironment } from "../src/game-creation/create-game-session.js";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
  gameEngineContext,
} from "../src/game-engine/runtime.js";
import type { GetGameSnapshotResult } from "../src/game-session/game-session.js";
import { createMatchLobbyInEnvironment } from "../src/match-lobby/match-lobby.js";

type MatchLobbyRpc = {
  initialize(input: {
    ownerPlayerId: string;
    ownerFaction: Faction;
    ownerDeckDefinitionIds: CardDefinitionId[];
    createdAt: number;
    expiresAt?: number;
    visibility?: "invite" | "public";
  }): Promise<{ initialized: true } | { initialized: false }>;
  getView(viewerPlayerId: string): Promise<
    | {
        visible: true;
        view: {
          status: "waiting" | "starting" | "started" | "cancelled";
          ownerPlayerId: string;
          ownerFaction: Faction;
          opponentPlayerId: string | null;
          opponentFaction: Faction | null;
          gameId: string | null;
        };
      }
    | {
        visible: false;
        error: { code: "MATCH_ACCESS_FORBIDDEN" | "MATCH_NOT_FOUND" };
      }
  >;
  getPublicSummary(): Promise<
    | {
        available: true;
        summary: {
          ownerFaction: Faction;
          createdAt: number;
          expiresAt: number;
        };
      }
    | { available: false; reason: "starting" | "terminal" }
  >;
  accept(input: {
    playerId: string;
    faction: Faction;
    deckDefinitionIds: CardDefinitionId[];
  }): Promise<
    | { accepted: true; gameId: string }
    | { accepted: false; error: { code: string } }
  >;
  cancel(
    playerId: string,
  ): Promise<
    { cancelled: true } | { cancelled: false; error: { code: string } }
  >;
};

describe("MatchLobby Durable Object", () => {
  it("初期化されていない招待IDは安定した未検出結果を返す", async () => {
    const lobby = getMatchLobby("match-lobby-missing");

    await expect(lobby.getView("player-1")).resolves.toEqual({
      visible: false,
      error: { code: "MATCH_NOT_FOUND" },
    });
    await expect(
      lobby.accept({
        playerId: "player-1",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "MATCH_NOT_FOUND" },
    });
    await expect(lobby.cancel("player-1")).resolves.toEqual({
      cancelled: false,
      error: { code: "MATCH_NOT_FOUND" },
    });
  });

  it("Workerは推測不可能なDurable Object IDで待機部屋を作成する", async () => {
    const result = await createMatchLobbyInEnvironment(
      {
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        ownerDeckDefinitionIds: createDeck(),
      },
      env,
      () => Date.now(),
    );

    expect(result).toMatchObject({
      created: true,
      matchId: expect.any(String),
    });
    if (!result.created) {
      throw new Error("対戦待機部屋を作成できませんでした。");
    }

    const lobby = getMatchLobbyById(result.matchId);
    await expect(lobby.getView("player-1")).resolves.toMatchObject({
      visible: true,
      view: { status: "waiting", ownerPlayerId: "player-1" },
    });
  });

  it("待機中の招待対戦を初期化し、招待 URL を開いた認証済みユーザーへ待機状態を公開する", async () => {
    const lobby = getMatchLobby("match-lobby-waiting");

    await expect(
      lobby.initialize({
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        ownerDeckDefinitionIds: createDeck(),
        createdAt: 1_000,
      }),
    ).resolves.toEqual({ initialized: true });

    await expect(lobby.getView("player-1")).resolves.toEqual({
      visible: true,
      view: {
        status: "waiting",
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        opponentPlayerId: null,
        opponentFaction: null,
        gameId: null,
      },
    });
    await expect(lobby.getView("player-3")).resolves.toEqual({
      visible: true,
      view: {
        status: "waiting",
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        opponentPlayerId: null,
        opponentFaction: null,
        gameId: null,
      },
    });
  });

  it("公開待機部屋だけを作成者の識別子なしで一覧候補として返す", async () => {
    const lobby = getMatchLobby("match-lobby-public");
    const createdAt = Date.now();
    const expiresAt = createdAt + 30 * 60 * 1_000;

    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      visibility: "public",
      createdAt,
      expiresAt,
    });

    await expect(lobby.getPublicSummary()).resolves.toEqual({
      available: true,
      summary: {
        ownerFaction: "disaster",
        createdAt,
        expiresAt,
      },
    });
  });

  it("待機期限を過ぎた部屋を参加・公開候補から外す", async () => {
    const lobby = getMatchLobby("match-lobby-expired");
    const expiresAt = Date.now() - 1;

    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      visibility: "public",
      createdAt: expiresAt - 1,
      expiresAt,
    });

    await expect(lobby.getPublicSummary()).resolves.toEqual({
      available: false,
      reason: "terminal",
    });
    await expect(lobby.getView("player-1")).resolves.toMatchObject({
      visible: true,
      view: { status: "cancelled" },
    });
  });

  it("相手の参加を一度だけ受け付け、信頼済みの2デッキからゲームを開始する", async () => {
    const lobby = getMatchLobby("match-lobby-start");
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt: 1_000,
    });

    const accepted = await lobby.accept({
      playerId: "player-2",
      faction: "countermeasure",
      deckDefinitionIds: createDeck("countermeasure"),
    });

    expect(accepted).toMatchObject({
      accepted: true,
      gameId: expect.any(String),
    });
    if (!accepted.accepted) {
      throw new Error("対戦参加が受理されませんでした。");
    }

    await expect(lobby.getView("player-1")).resolves.toEqual({
      visible: true,
      view: {
        status: "started",
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        opponentPlayerId: "player-2",
        opponentFaction: "countermeasure",
        gameId: accepted.gameId,
      },
    });
    await expect(lobby.getView("player-2")).resolves.toEqual({
      visible: true,
      view: {
        status: "started",
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        opponentPlayerId: "player-2",
        opponentFaction: "countermeasure",
        gameId: accepted.gameId,
      },
    });

    const snapshotResult = await getGameSession(accepted.gameId).getSnapshot(
      "player-1",
      0,
    );
    if (!snapshotResult.found) {
      throw new Error(
        "開始済みゲームのスナップショットを取得できませんでした。",
      );
    }
    const snapshot = snapshotResult.snapshot;
    expect(snapshot.view.gameId).toBe(accepted.gameId);
    expect(snapshot.view.opponent.playerId).toBe("player-2");

    await expect(
      lobby.accept({
        playerId: "player-3",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "MATCH_NOT_ACCEPTING" },
    });
  });

  it("作成者自身の参加と、失敗したゲーム作成を受理しない", async () => {
    const lobby = getMatchLobby("match-lobby-invalid");
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt: 1_000,
    });

    await expect(
      lobby.accept({
        playerId: "player-1",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "CANNOT_ACCEPT_OWN_MATCH" },
    });
    await expect(
      lobby.accept({
        playerId: "player-3",
        faction: "disaster",
        deckDefinitionIds: createDeck(),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "MATCH_FACTION_CONFLICT" },
    });
    await expect(
      lobby.accept({
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: [],
      }),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "GAME_CREATION_FAILED" },
    });
    await expect(lobby.getView("player-1")).resolves.toMatchObject({
      visible: true,
      view: {
        status: "waiting",
        opponentPlayerId: null,
      },
    });
  });

  it("GameSession初期化の結果が不明な場合は同じ参加者だけが開始を再試行できる", async () => {
    const lobby = getMatchLobby("match-lobby-initialize-exception");
    const createdAt = Date.now();
    const expiresAt = createdAt + 30 * 60 * 1_000;
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      visibility: "public",
      createdAt,
      expiresAt,
    });
    await failNextGameSessionInitialization(lobby);

    await expect(
      lobby.accept({
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "GAME_CREATION_FAILED" },
    });

    await expect(lobby.getView("player-1")).resolves.toMatchObject({
      visible: true,
      view: {
        status: "starting",
        opponentPlayerId: "player-2",
        opponentFaction: "countermeasure",
        gameId: null,
      },
    });
    await expect(lobby.getPublicSummary()).resolves.toEqual({
      available: false,
      reason: "starting",
    });
    await expect(getStoredMatch(lobby)).resolves.toMatchObject({
      status: "starting",
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      opponentPlayerId: "player-2",
      opponentFaction: "countermeasure",
      createdAt,
      expiresAt,
      visibility: "public",
      gameInput: {
        gameId: expect.any(String),
      },
    });
    await expect(getStoredAlarm(lobby)).resolves.toBe(expiresAt);

    await expect(
      lobby.accept({
        playerId: "player-3",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "MATCH_NOT_ACCEPTING" },
    });

    await expect(
      lobby.accept({
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toMatchObject({
      accepted: true,
      gameId: expect.any(String),
    });
  });

  it("GameSession初期化の例外後は作成者が待機部屋を取り消せる", async () => {
    const lobby = getMatchLobby("match-lobby-cancel-after-start-failure");
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt: Date.now(),
    });
    await failNextGameSessionInitialization(lobby);

    await expect(
      lobby.accept({
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toMatchObject({
      accepted: false,
      error: { code: "GAME_CREATION_FAILED" },
    });
    await expect(lobby.cancel("player-1")).resolves.toEqual({
      cancelled: true,
    });
    await expect(getStoredAlarm(lobby)).resolves.toBeNull();
  });

  it("初期化成功の応答だけ失われた開始を取り消すと孤立GameSessionを破棄する", async () => {
    const lobby = getMatchLobby("match-lobby-abandon-unknown-start");
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt: Date.now(),
    });
    await loseNextGameSessionInitializationResponse(lobby);

    await expect(
      lobby.accept({
        playerId: "player-2",
        faction: "countermeasure",
        deckDefinitionIds: createDeck("countermeasure"),
      }),
    ).resolves.toEqual({
      accepted: false,
      error: { code: "GAME_CREATION_FAILED" },
    });
    const starting = (await getStoredMatch(lobby)) as {
      gameInput: InitializeGameInput;
    };
    const gameSession = getGameSession(starting.gameInput.gameId);
    await expect(gameSession.getSnapshot("player-1")).resolves.toMatchObject({
      found: true,
    });

    await expect(lobby.cancel("player-1")).resolves.toEqual({
      cancelled: true,
    });
    await evictDurableObject(gameSession as unknown as DurableObjectStub);
    await expect(gameSession.getSnapshot("player-1")).resolves.toEqual({
      found: false,
      error: { code: "GAME_NOT_FOUND" },
    });
    await expect(
      gameSession.initialize(starting.gameInput),
    ).resolves.toMatchObject({
      initialized: false,
    });
    await expectCatalogLeaseReleased(
      starting.gameInput.gameId,
      gameEngineContext.cardCatalog.version,
    );
  });

  it("startingの取消保存後にAlarm削除が失敗しても参加再送で開始しない", async () => {
    const lobby = getMatchLobby("match-lobby-cancel-alarm-failure");
    const createdAt = Date.now();
    const expiresAt = createdAt + 30 * 60 * 1_000;
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt,
      expiresAt,
    });
    await seedStartingMatch(lobby, { createdAt, expiresAt });

    await runInDurableObject(
      lobby as unknown as DurableObjectStub,
      async (instance, state) => {
        const internals = instance as unknown as MatchLobbyInternals;
        internals.clearAlarm = async () => {
          throw new Error("simulated alarm deletion failure");
        };

        await expect(internals.cancel("player-1")).resolves.toEqual({
          cancelled: true,
        });
        await expect(
          state.storage.get("match-lobby-v2-factions"),
        ).resolves.toMatchObject({ status: "cancelled" });
        await expect(
          internals.accept({
            playerId: "player-2",
            faction: "countermeasure",
            deckDefinitionIds: createDeck("countermeasure"),
          }),
        ).resolves.toEqual({
          accepted: false,
          error: { code: "MATCH_NOT_ACCEPTING" },
        });
      },
    );
  });

  it("待機期限を過ぎたstarting状態を取り消して参加情報を公開しない", async () => {
    const lobby = getMatchLobby("match-lobby-expired-starting");
    const createdAt = Date.now() - 2;
    const expiresAt = createdAt + 1;
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt,
      expiresAt,
    });
    await seedStartingMatch(lobby, {
      createdAt,
      expiresAt,
    });

    await expect(lobby.getView("player-1")).resolves.toEqual({
      visible: true,
      view: {
        status: "cancelled",
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        opponentPlayerId: null,
        opponentFaction: null,
        gameId: null,
      },
    });
    await expect(lobby.getView("player-2")).resolves.toEqual({
      visible: false,
      error: { code: "MATCH_ACCESS_FORBIDDEN" },
    });
    await expect(getStoredAlarm(lobby)).resolves.toBeNull();
  });

  it("待機中の招待は作成者だけが取り消せる", async () => {
    const lobby = getMatchLobby("match-lobby-cancel");
    await lobby.initialize({
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      ownerDeckDefinitionIds: createDeck(),
      createdAt: 1_000,
    });

    await expect(lobby.cancel("player-2")).resolves.toEqual({
      cancelled: false,
      error: { code: "MATCH_CANCELLATION_FORBIDDEN" },
    });
    await expect(lobby.cancel("player-1")).resolves.toEqual({
      cancelled: true,
    });
    await expect(lobby.getView("player-1")).resolves.toEqual({
      visible: true,
      view: {
        status: "cancelled",
        ownerPlayerId: "player-1",
        ownerFaction: "disaster",
        opponentPlayerId: null,
        opponentFaction: null,
        gameId: null,
      },
    });
  });
});

function getMatchLobby(matchName: string): MatchLobbyRpc {
  const matchLobbies = env.MATCH_LOBBY as unknown as {
    getByName(name: string): MatchLobbyRpc;
  };
  return matchLobbies.getByName(matchName);
}

function getMatchLobbyById(matchId: string): MatchLobbyRpc {
  const matchLobbies = env.MATCH_LOBBY as unknown as {
    idFromString(id: string): unknown;
    get(id: unknown): MatchLobbyRpc;
  };
  return matchLobbies.get(matchLobbies.idFromString(matchId));
}

function getGameSession(gameId: string): {
  initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
  getSnapshot(
    viewerPlayerId: string,
    afterSequence?: number,
  ): Promise<GetGameSnapshotResult>;
} {
  const gameSessions = env.GAME_SESSION as unknown as {
    getByName(name: string): {
      initialize(input: InitializeGameInput): Promise<{ initialized: boolean }>;
      getSnapshot(
        viewerPlayerId: string,
        afterSequence?: number,
      ): Promise<GetGameSnapshotResult>;
    };
  };
  return gameSessions.getByName(gameId);
}

function getCatalogArchive(): {
  getCatalog(version: string): Promise<unknown>;
} {
  const archives = env.CATALOG_ARCHIVE as unknown as {
    getByName(name: string): {
      getCatalog(version: string): Promise<unknown>;
    };
  };
  return archives.getByName("card-catalog-retention");
}

async function expectCatalogLeaseReleased(
  gameId: string,
  version: string,
): Promise<void> {
  await runInDurableObject(
    getCatalogArchive() as unknown as DurableObjectStub,
    async (instance) => {
      const archive = instance as unknown as {
        archive: {
          entries: Record<
            string,
            { leases: Record<string, number | null> } | undefined
          >;
        };
      };
      expect(archive.archive.entries[version]?.leases[gameId]).toBeUndefined();
    },
  );
}

function createDeck(faction: Faction = "disaster"): CardDefinitionId[] {
  return faction === "disaster"
    ? createDisasterStarterDeckDefinitionIds()
    : createCountermeasureStarterDeckDefinitionIds();
}

type MatchLobbyInternals = {
  match: unknown;
  accept(input: {
    playerId: string;
    faction: Faction;
    deckDefinitionIds: CardDefinitionId[];
  }): ReturnType<MatchLobbyRpc["accept"]>;
  cancel(playerId: string): ReturnType<MatchLobbyRpc["cancel"]>;
  clearAlarm(): Promise<void>;
  initializeGameSession?: (
    input: InitializeGameInput,
  ) => ReturnType<typeof initializeGameSessionInEnvironment>;
};

async function failNextGameSessionInitialization(
  lobby: MatchLobbyRpc,
): Promise<void> {
  await runInDurableObject(
    lobby as unknown as DurableObjectStub,
    async (instance) => {
      const internals = instance as unknown as MatchLobbyInternals;
      let shouldFail = true;
      internals.initializeGameSession = async (input) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("simulated GameSession initialization failure");
        }
        return initializeGameSessionInEnvironment(input, env);
      };
    },
  );
}

async function loseNextGameSessionInitializationResponse(
  lobby: MatchLobbyRpc,
): Promise<void> {
  await runInDurableObject(
    lobby as unknown as DurableObjectStub,
    async (instance) => {
      const internals = instance as unknown as MatchLobbyInternals;
      let shouldLoseResponse = true;
      internals.initializeGameSession = async (input) => {
        const initialized = await initializeGameSessionInEnvironment(
          input,
          env,
        );
        if (shouldLoseResponse) {
          shouldLoseResponse = false;
          throw new Error("simulated lost GameSession initialization response");
        }
        return initialized;
      };
    },
  );
}

async function getStoredMatch(lobby: MatchLobbyRpc): Promise<unknown> {
  return runInDurableObject(
    lobby as unknown as DurableObjectStub,
    async (_instance, state) => state.storage.get("match-lobby-v2-factions"),
  );
}

async function getStoredAlarm(lobby: MatchLobbyRpc): Promise<number | null> {
  return runInDurableObject(
    lobby as unknown as DurableObjectStub,
    async (_instance, state) => state.storage.getAlarm(),
  );
}

async function seedStartingMatch(
  lobby: MatchLobbyRpc,
  timing: { createdAt: number; expiresAt: number },
): Promise<void> {
  const starting = {
    status: "starting" as const,
    ownerPlayerId: "player-1",
    ownerFaction: "disaster" as const,
    ownerDeckDefinitionIds: createDeck(),
    opponentPlayerId: "player-2",
    opponentFaction: "countermeasure" as const,
    opponentDeckDefinitionIds: createDeck("countermeasure"),
    ...timing,
    visibility: "invite" as const,
    gameInput: {
      gameId: `game-${crypto.randomUUID()}`,
      randomSeed: crypto.randomUUID(),
      players: [
        {
          playerId: "player-1",
          faction: "disaster" as const,
          deckDefinitionIds: createDeck(),
        },
        {
          playerId: "player-2",
          faction: "countermeasure" as const,
          deckDefinitionIds: createDeck("countermeasure"),
        },
      ],
    },
  };

  await runInDurableObject(
    lobby as unknown as DurableObjectStub,
    async (instance, state) => {
      (instance as unknown as MatchLobbyInternals).match = starting;
      await state.storage.put("match-lobby-v2-factions", starting);
    },
  );
}
