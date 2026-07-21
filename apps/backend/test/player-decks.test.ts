import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { CardDefinitionId } from "@disastar/game-engine/contracts";
import { createInitialStarterDeckDefinitionIds } from "../src/game-engine/runtime.js";
import { resolveAuthorizedDeckInEnvironment } from "../src/player-decks/resolve-authorized-deck.js";

type PlayerDecksRpc = {
  create(input: {
    name: string;
    cardDefinitionIds: CardDefinitionId[];
    createdAt: number;
  }): Promise<{
    id: string;
    name: string;
    cardDefinitionIds: CardDefinitionId[];
    createdAt: number;
    updatedAt: number;
  }>;
  list(): Promise<
    {
      id: string;
      name: string;
      cardDefinitionIds: CardDefinitionId[];
      createdAt: number;
      updatedAt: number;
    }[]
  >;
  get(deckId: string): Promise<{
    id: string;
    name: string;
    cardDefinitionIds: CardDefinitionId[];
    createdAt: number;
    updatedAt: number;
  } | null>;
  replace(
    deckId: string,
    input: {
      name: string;
      cardDefinitionIds: CardDefinitionId[];
      updatedAt: number;
    },
  ): Promise<{
    id: string;
    name: string;
    cardDefinitionIds: CardDefinitionId[];
    createdAt: number;
    updatedAt: number;
  } | null>;
  remove(deckId: string): Promise<boolean>;
};

describe("PlayerDecks Durable Object", () => {
  it("プレイヤーごとにデッキを永続化し、他のプレイヤーと混在させない", async () => {
    const playerOne = getPlayerDecks("player-deck-one");
    const playerTwo = getPlayerDecks("player-deck-two");

    const created = await playerOne.create({
      name: "最初のデッキ",
      cardDefinitionIds: createDeck(),
      createdAt: 1_000,
    });

    await expect(playerOne.list()).resolves.toEqual([
      {
        ...created,
        cardDefinitionIds: createDeck(),
      },
    ]);
    await expect(playerTwo.list()).resolves.toEqual([]);
  });

  it("デッキを置換・削除し、存在しないデッキはnullまたはfalseを返す", async () => {
    const decks = getPlayerDecks("player-deck-mutation");
    const created = await decks.create({
      name: "置換前",
      cardDefinitionIds: createDeck(),
      createdAt: 1_000,
    });

    await expect(
      decks.replace(created.id, {
        name: "置換後",
        cardDefinitionIds: createDeck(),
        updatedAt: 2_000,
      }),
    ).resolves.toEqual({
      ...created,
      name: "置換後",
      cardDefinitionIds: createDeck(),
      updatedAt: 2_000,
    });
    await expect(decks.get("unknown-deck")).resolves.toBeNull();
    await expect(decks.remove(created.id)).resolves.toBe(true);
    await expect(decks.remove(created.id)).resolves.toBe(false);
  });

  it("保存済みデッキを現在のルールで再検証して対戦用カード配列を解決する", async () => {
    const decks = getPlayerDecks("player-deck-authorization");
    const validDeck = await decks.create({
      name: "対戦可能",
      cardDefinitionIds: createDeck(),
      createdAt: 1_000,
    });
    const invalidDeck = await decks.create({
      name: "無効",
      cardDefinitionIds: ["attack-1"],
      createdAt: 1_000,
    });

    await expect(
      resolveAuthorizedDeckInEnvironment(
        "player-deck-authorization",
        validDeck.id,
        env,
      ),
    ).resolves.toEqual(createDeck());
    await expect(
      resolveAuthorizedDeckInEnvironment(
        "player-deck-authorization",
        invalidDeck.id,
        env,
      ),
    ).resolves.toBeNull();
    await expect(
      resolveAuthorizedDeckInEnvironment("another-player", validDeck.id, env),
    ).resolves.toBeNull();
  });
});

function getPlayerDecks(playerId: string): PlayerDecksRpc {
  const playerDecks = env.PLAYER_DECKS as unknown as {
    getByName(name: string): PlayerDecksRpc;
  };
  return playerDecks.getByName(playerId);
}

function createDeck(): CardDefinitionId[] {
  return createInitialStarterDeckDefinitionIds();
}
