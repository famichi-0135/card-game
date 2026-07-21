import { describe, expect, it } from "vitest";
import {
  parseAcceptMatchRequest,
  parseCreateMatchRequest,
  type MatchLobbyView,
} from "@disastar/contracts/match";
import type { CardDefinitionId } from "@disastar/game-engine/contracts";
import { createMatchApi } from "../src/match-api/create-match-api.js";
import worker from "../src/index.js";
import { createAuthTestBindings } from "./auth-test-bindings.js";

const deckDefinitionIds: CardDefinitionId[] = ["attack-fire-001"];
const waitingMatch: MatchLobbyView = {
  status: "waiting",
  ownerPlayerId: "player-1",
  opponentPlayerId: null,
  gameId: null,
};

describe("対戦待機リクエストの検証", () => {
  it("作成・参加リクエストではdeckIdだけを受け付ける", () => {
    expect(parseCreateMatchRequest({ deckId: "deck-1" })).toEqual({
      parsed: true,
      request: { deckId: "deck-1" },
    });
    expect(parseAcceptMatchRequest({ deckId: "deck-2" })).toEqual({
      parsed: true,
      request: { deckId: "deck-2" },
    });
    expect(
      parseCreateMatchRequest({ deckId: "deck-1", playerId: "player-1" }),
    ).toMatchObject({ parsed: false });
    expect(parseAcceptMatchRequest({ deckId: " " })).toMatchObject({
      parsed: false,
    });
  });
});

describe("対戦待機 HTTP API", () => {
  it("標準WorkerはセッションCookieがない対戦待機APIリクエストを拒否する", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/api/matches"),
      createAuthTestBindings(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("不正な本文をデッキ認可やDurable Objectの前で拒否する", async () => {
    let resolvedDeck = false;
    let createdLobby = false;
    const api = createMatchApi({
      authenticate: async () => "player-1",
      resolveAuthorizedDeck: async () => {
        resolvedDeck = true;
        return deckDefinitionIds;
      },
      createMatchLobby: async () => {
        createdLobby = true;
        return { created: true, matchId: "match-1" };
      },
    });

    const response = await request(api, "/", {
      method: "POST",
      body: JSON.stringify({ deckId: "deck-1", playerId: "player-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(resolvedDeck).toBe(false);
    expect(createdLobby).toBe(false);
  });

  it("認証済みプレイヤーの所有デッキだけで待機部屋を作成する", async () => {
    const resolvedDecks: Array<{ playerId: string; deckId: string }> = [];
    const created: Array<{
      ownerPlayerId: string;
      ownerDeckDefinitionIds: CardDefinitionId[];
    }> = [];
    const api = createMatchApi({
      authenticate: async () => "player-1",
      resolveAuthorizedDeck: async (playerId, deckId) => {
        resolvedDecks.push({ playerId, deckId });
        return deckDefinitionIds;
      },
      createMatchLobby: async (input) => {
        created.push(input);
        return { created: true, matchId: "match-created-by-server" };
      },
    });

    const response = await request(api, "/", {
      method: "POST",
      body: JSON.stringify({ deckId: "deck-1" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      matchId: "match-created-by-server",
    });
    expect(resolvedDecks).toEqual([{ playerId: "player-1", deckId: "deck-1" }]);
    expect(created).toEqual([
      {
        ownerPlayerId: "player-1",
        ownerDeckDefinitionIds: deckDefinitionIds,
      },
    ]);
  });

  it("参加者だけが待機状態を取得できる", async () => {
    const api = createMatchApi({
      authenticate: async () => "player-2",
      resolveAuthorizedDeck: async () => deckDefinitionIds,
      getMatchLobby: () => ({
        getView: async () => ({
          visible: false as const,
          error: { code: "MATCH_ACCESS_FORBIDDEN" as const },
        }),
        accept: async () => ({ accepted: true as const, gameId: "game-1" }),
        cancel: async () => ({ cancelled: true as const }),
      }),
    });

    const response = await request(api, "/match-1");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "MATCH_ACCESS_FORBIDDEN" },
    });
  });

  it("参加時は認証済みプレイヤーの所有デッキを渡し、開始済みゲームIDを返す", async () => {
    const acceptedInputs: Array<{
      playerId: string;
      deckDefinitionIds: CardDefinitionId[];
    }> = [];
    const api = createMatchApi({
      authenticate: async () => "player-2",
      resolveAuthorizedDeck: async (playerId, deckId) => {
        expect({ playerId, deckId }).toEqual({
          playerId: "player-2",
          deckId: "deck-2",
        });
        return deckDefinitionIds;
      },
      getMatchLobby: (matchId) => {
        expect(matchId).toBe("match-1");
        return {
          getView: async () => ({ visible: true as const, view: waitingMatch }),
          accept: async (input) => {
            acceptedInputs.push(input);
            return { accepted: true as const, gameId: "game-started" };
          },
          cancel: async () => ({ cancelled: true as const }),
        };
      },
    });

    const response = await request(api, "/match-1/accept", {
      method: "POST",
      body: JSON.stringify({ deckId: "deck-2" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accepted: true,
      gameId: "game-started",
    });
    expect(acceptedInputs).toEqual([
      { playerId: "player-2", deckDefinitionIds },
    ]);
  });

  it("所有していないデッキでは参加処理を呼ばない", async () => {
    let resolvedLobby = false;
    const api = createMatchApi({
      authenticate: async () => "player-2",
      resolveAuthorizedDeck: async () => null,
      getMatchLobby: () => {
        resolvedLobby = true;
        throw new Error("デッキ認可前に待機部屋を取得してはいけません。");
      },
    });

    const response = await request(api, "/match-1/accept", {
      method: "POST",
      body: JSON.stringify({ deckId: "unknown-deck" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "DECK_NOT_FOUND" },
    });
    expect(resolvedLobby).toBe(false);
  });

  it("取消は認証済み作成者として待機部屋へ中継する", async () => {
    const cancelledBy: string[] = [];
    const api = createMatchApi({
      authenticate: async () => "player-1",
      resolveAuthorizedDeck: async () => deckDefinitionIds,
      getMatchLobby: () => ({
        getView: async () => ({ visible: true as const, view: waitingMatch }),
        accept: async () => ({ accepted: true as const, gameId: "game-1" }),
        cancel: async (playerId) => {
          cancelledBy.push(playerId);
          return { cancelled: true as const };
        },
      }),
    });

    const response = await request(api, "/match-1/cancel", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cancelled: true });
    expect(cancelledBy).toEqual(["player-1"]);
  });
});

async function request(
  api: ReturnType<typeof createMatchApi>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return await api.fetch(
    new Request(`http://example.com${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    }),
    {} as CloudflareBindings,
  );
}
