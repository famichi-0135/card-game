import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  CardDefinitionId,
  Faction,
} from "@disastar/game-engine/contracts";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
} from "../src/game-engine/runtime.js";
import type { GetGameSnapshotResult } from "../src/game-session/game-session.js";
import { createMatchLobbyInEnvironment } from "../src/match-lobby/match-lobby.js";

type MatchLobbyRpc = {
  initialize(input: {
    ownerPlayerId: string;
    ownerFaction: Faction;
    ownerDeckDefinitionIds: CardDefinitionId[];
    createdAt: number;
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
      () => 1_000,
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

  it("待機中の招待対戦を初期化し、参加者以外へは状態を公開しない", async () => {
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
      visible: false,
      error: { code: "MATCH_ACCESS_FORBIDDEN" },
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
  getSnapshot(
    viewerPlayerId: string,
    afterSequence?: number,
  ): Promise<GetGameSnapshotResult>;
} {
  const gameSessions = env.GAME_SESSION as unknown as {
    getByName(name: string): {
      getSnapshot(
        viewerPlayerId: string,
        afterSequence?: number,
      ): Promise<GetGameSnapshotResult>;
    };
  };
  return gameSessions.getByName(gameId);
}

function createDeck(faction: Faction = "disaster"): CardDefinitionId[] {
  return faction === "disaster"
    ? createDisasterStarterDeckDefinitionIds()
    : createCountermeasureStarterDeckDefinitionIds();
}
