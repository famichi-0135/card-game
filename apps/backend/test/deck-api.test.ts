import { describe, expect, it } from "vitest";
import {
  parseCreateDeckRequest,
  parseReplaceDeckRequest,
} from "@disastar/contracts/deck";
import type { CardDefinitionId } from "@disastar/game-engine/contracts";
import { createDeckApi } from "../src/deck-api/create-deck-api.js";
import worker from "../src/index.js";

const validDeck: CardDefinitionId[] = ["attack-1"];

describe("保存済みデッキのリクエスト検証", () => {
  it("作成・置換リクエストでは名前とカード定義ID配列だけを受け付ける", () => {
    expect(
      parseCreateDeckRequest({
        name: "炎デッキ",
        cardDefinitionIds: validDeck,
      }),
    ).toEqual({
      parsed: true,
      request: { name: "炎デッキ", cardDefinitionIds: validDeck },
    });
    expect(
      parseReplaceDeckRequest({
        name: "炎デッキ",
        cardDefinitionIds: validDeck,
      }),
    ).toMatchObject({ parsed: true });
    expect(
      parseCreateDeckRequest({
        name: "炎デッキ",
        cardDefinitionIds: validDeck,
        playerId: "player-1",
      }),
    ).toMatchObject({ parsed: false });
  });
});

describe("保存済みデッキ HTTP API", () => {
  it("標準Workerは認証アダプター未接続時にデッキAPIを拒否する", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/api/decks"),
      {} as CloudflareBindings,
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
      body: JSON.stringify({ name: "不正", cardDefinitionIds: [] }),
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
        cardDefinitionIds: createValidDeck(),
      }),
    });
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      deck: { id: "deck-1", name: "炎デッキ", createdAt: 1_000 },
    });

    const replaceResponse = await request(api, "/deck-1", {
      method: "PUT",
      body: JSON.stringify({
        name: "炎デッキ改",
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
    "attack-2",
    "attack-2",
    "attack-3",
    "attack-3",
    "attack-4",
    "attack-4",
    "attack-5",
    "attack-5",
    "attack-6",
    "attack-6",
    "attack-7",
    "attack-7",
    "attack-8",
    "attack-8",
    "support-fire-001",
    "support-water-001",
    "support-water-002",
    "support-wind-001",
    "support-wind-003",
    "support-fire-004",
  ];
}
