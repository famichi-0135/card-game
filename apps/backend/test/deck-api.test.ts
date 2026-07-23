import { describe, expect, it } from "vitest";
import {
  parseCreateDeckRequest,
  parseCreateStarterDeckRequest,
  parseReplaceDeckRequest,
} from "@disastar/contracts/deck";
import type {
  CardDefinitionId,
  Faction,
} from "@disastar/game-engine/contracts";
import { createDeckApi } from "../src/deck-api/create-deck-api.js";
import { createDisasterStarterDeckDefinitionIds } from "../src/game-engine/runtime.js";
import worker from "../src/index.js";
import { createAuthTestBindings } from "./auth-test-bindings.js";

const validDeck: CardDefinitionId[] = ["disaster-attack-1"];

describe("保存済みデッキのリクエスト検証", () => {
  it("作成・置換リクエストでは名前、陣営、カード定義ID配列だけを受け付ける", () => {
    expect(
      parseCreateDeckRequest({
        name: "炎デッキ",
        faction: "disaster",
        cardDefinitionIds: validDeck,
      }),
    ).toEqual({
      parsed: true,
      request: {
        name: "炎デッキ",
        faction: "disaster",
        cardDefinitionIds: validDeck,
      },
    });
    expect(
      parseReplaceDeckRequest({
        name: "炎デッキ",
        faction: "disaster",
        cardDefinitionIds: validDeck,
      }),
    ).toMatchObject({ parsed: true });
    expect(
      parseCreateDeckRequest({
        name: "炎デッキ",
        faction: "disaster",
        cardDefinitionIds: validDeck,
        playerId: "player-1",
      }),
    ).toMatchObject({ parsed: false });
    expect(
      parseCreateDeckRequest({
        name: "炎デッキ",
        faction: "unknown",
        cardDefinitionIds: validDeck,
      }),
    ).toMatchObject({ parsed: false });
  });

  it("スターターデッキ作成では陣営だけを受け付ける", () => {
    expect(parseCreateStarterDeckRequest({ faction: "disaster" })).toEqual({
      parsed: true,
      request: { faction: "disaster" },
    });
    expect(
      parseCreateStarterDeckRequest({
        faction: "disaster",
        cardDefinitionIds: validDeck,
      }),
    ).toMatchObject({ parsed: false });
  });
});

describe("保存済みデッキ HTTP API", () => {
  it("標準WorkerはセッションCookieがないデッキAPIリクエストを拒否する", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/api/decks"),
      createAuthTestBindings(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("不正な本文をデッキ保存より前に拒否する", async () => {
    let created = false;
    const api = createDeckApi({
      authenticate: async () => "player-1",
      getPlayerDecks: () => ({
        create: async () => {
          created = true;
          throw new Error("呼び出されない想定です。");
        },
        get: async () => null,
        list: async () => [],
        replace: async () => null,
        remove: async () => false,
      }),
    });

    const response = await request(api, "/", {
      method: "POST",
      body: JSON.stringify({
        name: "不正",
        faction: "disaster",
        cardDefinitionIds: [],
      }),
    });

    expect(response.status).toBe(422);
    expect(created).toBe(false);
  });

  it("認証済みプレイヤーのデッキだけを作成・取得・置換・削除する", async () => {
    const decks = new Map<
      string,
      {
        id: string;
        name: string;
        faction: Faction;
        cardDefinitionIds: CardDefinitionId[];
        createdAt: number;
        updatedAt: number;
      }
    >();
    const api = createDeckApi({
      authenticate: async () => "player-1",
      now: () => 1_000,
      getPlayerDecks: () => ({
        create: async (input) => {
          const deck = { id: "deck-1", ...input, updatedAt: input.createdAt };
          decks.set(deck.id, deck);
          return deck;
        },
        get: async (deckId) => decks.get(deckId) ?? null,
        list: async () => [...decks.values()],
        replace: async (deckId, input) => {
          const current = decks.get(deckId);
          if (current === undefined) {
            return null;
          }
          const replaced = { ...current, ...input };
          decks.set(deckId, replaced);
          return replaced;
        },
        remove: async (deckId) => decks.delete(deckId),
      }),
    });

    const createResponse = await request(api, "/", {
      method: "POST",
      body: JSON.stringify({
        name: "炎デッキ",
        faction: "disaster",
        cardDefinitionIds: createValidDeck(),
      }),
    });
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      deck: {
        id: "deck-1",
        name: "炎デッキ",
        faction: "disaster",
        createdAt: 1_000,
      },
    });

    const replaceResponse = await request(api, "/deck-1", {
      method: "PUT",
      body: JSON.stringify({
        name: "炎デッキ改",
        faction: "disaster",
        cardDefinitionIds: createValidDeck(),
      }),
    });
    expect(replaceResponse.status).toBe(200);
    expect(await replaceResponse.json()).toMatchObject({
      deck: { id: "deck-1", name: "炎デッキ改", updatedAt: 1_000 },
    });

    const listResponse = await request(api, "/");
    expect(await listResponse.json()).toMatchObject({
      decks: [{ id: "deck-1", name: "炎デッキ改" }],
    });

    const deleteResponse = await request(api, "/deck-1", { method: "DELETE" });
    expect(deleteResponse.status).toBe(204);
    expect(decks.size).toBe(0);
  });

  it("スターターデッキをサーバー側の正規カード構成で作成する", async () => {
    let created:
      | {
          name: string;
          faction: Faction;
          cardDefinitionIds: CardDefinitionId[];
          createdAt: number;
        }
      | undefined;
    const api = createDeckApi({
      authenticate: async () => "player-1",
      now: () => 1_000,
      getPlayerDecks: () => ({
        create: async (input) => {
          created = input;
          return { id: "starter-deck", ...input, updatedAt: input.createdAt };
        },
        get: async () => null,
        list: async () => [],
        replace: async () => null,
        remove: async () => false,
      }),
    });

    const response = await request(api, "/starter", {
      method: "POST",
      body: JSON.stringify({ faction: "disaster" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      deck: {
        id: "starter-deck",
        name: "災害側スターターデッキ",
        faction: "disaster",
      },
    });
    expect(created).toMatchObject({
      faction: "disaster",
      createdAt: 1_000,
      cardDefinitionIds: createDisasterStarterDeckDefinitionIds(),
    });
  });

  it("同じロールの正規スターターデッキを重複作成しない", async () => {
    let created = false;
    const existing = {
      id: "existing-starter-deck",
      name: "災害側スターターデッキ",
      faction: "disaster" as const,
      cardDefinitionIds: createDisasterStarterDeckDefinitionIds(),
      createdAt: 1_000,
      updatedAt: 1_000,
    };
    const api = createDeckApi({
      authenticate: async () => "player-1",
      getPlayerDecks: () => ({
        create: async () => {
          created = true;
          throw new Error("既存スターターデッキを再作成してはいけません。");
        },
        get: async () => null,
        list: async () => [existing],
        replace: async () => null,
        remove: async () => false,
      }),
    });

    const response = await request(api, "/starter", {
      method: "POST",
      body: JSON.stringify({ faction: "disaster" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deck: existing });
    expect(created).toBe(false);
  });
});

async function request(
  api: ReturnType<typeof createDeckApi>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return await api.fetch(
    new Request(`http://example.com${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    }),
    {} as CloudflareBindings,
  );
}

function createValidDeck(): CardDefinitionId[] {
  return createDisasterStarterDeckDefinitionIds();
}
