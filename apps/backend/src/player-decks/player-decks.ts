import { DurableObject } from "cloudflare:workers";
import type { SavedDeckView } from "@disastar/contracts/deck";
import type {
  CardDefinitionId,
  Faction,
  PlayerId,
} from "@disastar/game-engine/contracts";

const PLAYER_DECKS_STORAGE_KEY = "player-decks-v2-factions";

type PlayerDecksState = {
  decks: SavedDeckView[];
};

export type PlayerDecksRpc = {
  create(input: CreateSavedDeckInput): Promise<SavedDeckView>;
  list(): Promise<SavedDeckView[]>;
  get(deckId: string): Promise<SavedDeckView | null>;
  replace(
    deckId: string,
    input: ReplaceSavedDeckInput,
  ): Promise<SavedDeckView | null>;
  remove(deckId: string): Promise<boolean>;
};

export type CreateSavedDeckInput = {
  name: string;
  faction: Faction;
  cardDefinitionIds: CardDefinitionId[];
  createdAt: number;
};

export type ReplaceSavedDeckInput = {
  name: string;
  faction: Faction;
  cardDefinitionIds: CardDefinitionId[];
  updatedAt: number;
};

/**
 * 1プレイヤーの保存済みデッキを直列化して管理する Durable Object。
 * プレイヤーIDから決定的に取得され、他プレイヤーのデッキを参照できない。
 */
export class PlayerDecks extends DurableObject<CloudflareBindings> {
  private decks: SavedDeckView[] = [];
  private readonly loadDecks: Promise<void>;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.loadDecks = this.ctx.blockConcurrencyWhile(async () => {
      const state = await this.ctx.storage.get<PlayerDecksState>(
        PLAYER_DECKS_STORAGE_KEY,
      );
      this.decks = state?.decks.map(copyDeck) ?? [];
    });
  }

  async create(input: CreateSavedDeckInput): Promise<SavedDeckView> {
    await this.loadDecks;
    assertDeckInput(
      input.name,
      input.faction,
      input.cardDefinitionIds,
      input.createdAt,
    );

    const deck: SavedDeckView = {
      id: `deck-${crypto.randomUUID()}`,
      name: input.name.trim(),
      faction: input.faction,
      cardDefinitionIds: [...input.cardDefinitionIds],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    this.decks = [...this.decks, deck];
    await this.persist();
    return copyDeck(deck);
  }

  async list(): Promise<SavedDeckView[]> {
    await this.loadDecks;
    return this.decks.map(copyDeck);
  }

  async get(deckId: string): Promise<SavedDeckView | null> {
    await this.loadDecks;
    return copyFoundDeck(this.decks.find((deck) => deck.id === deckId));
  }

  async replace(
    deckId: string,
    input: ReplaceSavedDeckInput,
  ): Promise<SavedDeckView | null> {
    await this.loadDecks;
    assertDeckInput(
      input.name,
      input.faction,
      input.cardDefinitionIds,
      input.updatedAt,
    );
    const index = this.decks.findIndex((deck) => deck.id === deckId);
    if (index === -1) {
      return null;
    }

    const current = this.decks[index];
    const replaced: SavedDeckView = {
      id: current.id,
      name: input.name.trim(),
      faction: input.faction,
      cardDefinitionIds: [...input.cardDefinitionIds],
      createdAt: current.createdAt,
      updatedAt: input.updatedAt,
    };
    this.decks = this.decks.map((deck, deckIndex) =>
      deckIndex === index ? replaced : deck,
    );
    await this.persist();
    return copyDeck(replaced);
  }

  async remove(deckId: string): Promise<boolean> {
    await this.loadDecks;
    const index = this.decks.findIndex((deck) => deck.id === deckId);
    if (index === -1) {
      return false;
    }

    this.decks = this.decks.filter((deck) => deck.id !== deckId);
    await this.persist();
    return true;
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(PLAYER_DECKS_STORAGE_KEY, {
      decks: this.decks.map(copyDeck),
    } satisfies PlayerDecksState);
  }
}

export function getPlayerDecksInEnvironment(
  playerId: PlayerId,
  environment: CloudflareBindings,
): PlayerDecksRpc {
  assertNonEmptyString(playerId, "プレイヤーID");
  return environment.PLAYER_DECKS.get(
    environment.PLAYER_DECKS.idFromName(playerId),
  ) as unknown as PlayerDecksRpc;
}

function assertDeckInput(
  name: string,
  faction: Faction,
  cardDefinitionIds: readonly CardDefinitionId[],
  timestamp: number,
): void {
  assertNonEmptyString(name, "デッキ名");
  if (faction !== "disaster" && faction !== "countermeasure") {
    throw new RangeError("デッキ陣営が不正です。");
  }
  for (const cardDefinitionId of cardDefinitionIds) {
    assertNonEmptyString(cardDefinitionId, "カード定義ID");
  }
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new RangeError("デッキの時刻は0以上の安全な整数で指定してください。");
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${label}は空文字列にできません。`);
  }
}

function copyFoundDeck(deck: SavedDeckView | undefined): SavedDeckView | null {
  return deck === undefined ? null : copyDeck(deck);
}

function copyDeck(deck: SavedDeckView): SavedDeckView {
  return { ...deck, cardDefinitionIds: [...deck.cardDefinitionIds] };
}
