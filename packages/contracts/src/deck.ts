import type {
  CardDefinitionId,
  DeckValidationError,
  Faction,
} from "@disastar/game-engine/contracts";

/** クライアントが選択する、保存済みデッキの不透明な識別子。 */
export type DeckId = string;

/** 所有者にだけ返す保存済みデッキ。 */
export type SavedDeckView = {
  id: DeckId;
  name: string;
  faction: Faction;
  cardDefinitionIds: CardDefinitionId[];
  createdAt: number;
  updatedAt: number;
};

export type CreateDeckRequest = {
  name: string;
  faction: Faction;
  cardDefinitionIds: CardDefinitionId[];
};

export type ReplaceDeckRequest = CreateDeckRequest;
export type CreateStarterDeckRequest = { faction: Faction };

export type DeckRequestParseError = {
  code: "INVALID_DECK_REQUEST";
  message: string;
  path: string;
};

export type ParseDeckRequestResult<T> =
  | { parsed: true; request: T }
  | { parsed: false; errors: DeckRequestParseError[] };

export function parseCreateDeckRequest(
  input: unknown,
): ParseDeckRequestResult<CreateDeckRequest> {
  return parseDeckRequest(input);
}

export function parseReplaceDeckRequest(
  input: unknown,
): ParseDeckRequestResult<ReplaceDeckRequest> {
  return parseDeckRequest(input);
}

export function parseCreateStarterDeckRequest(
  input: unknown,
): ParseDeckRequestResult<CreateStarterDeckRequest> {
  if (!isRecord(input)) {
    return invalid(
      "リクエスト本文はJSONオブジェクトでなければなりません。",
      "",
    );
  }

  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "faction") {
    return invalid("リクエスト本文にはfactionだけを含めてください。", "");
  }
  if (input.faction !== "disaster" && input.faction !== "countermeasure") {
    return invalid(
      "factionはdisasterまたはcountermeasureで指定してください。",
      "/faction",
    );
  }

  return { parsed: true, request: { faction: input.faction } };
}

export type CreateDeckResponse = { deck: SavedDeckView };
export type CreateStarterDeckResponse = { deck: SavedDeckView };
export type GetDeckResponse = { deck: SavedDeckView };
export type ListDecksResponse = { decks: SavedDeckView[] };
export type ReplaceDeckResponse = { deck: SavedDeckView };

export type DeckApiErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_REQUEST"
  | "DECK_NOT_FOUND"
  | "DECK_VALIDATION_FAILED";

export type DeckApiErrorResponse = {
  error: { code: DeckApiErrorCode };
  errors?: DeckRequestParseError[];
  deckValidationErrors?: DeckValidationError[];
};

function parseDeckRequest(
  input: unknown,
): ParseDeckRequestResult<CreateDeckRequest> {
  if (!isRecord(input)) {
    return invalid(
      "リクエスト本文はJSONオブジェクトでなければなりません。",
      "",
    );
  }

  const keys = Object.keys(input).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "cardDefinitionIds" ||
    keys[1] !== "faction" ||
    keys[2] !== "name"
  ) {
    return invalid(
      "リクエスト本文にはname、faction、cardDefinitionIdsだけを含めてください。",
      "",
    );
  }
  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    return invalid("nameは空でない文字列で指定してください。", "/name");
  }
  if (input.faction !== "disaster" && input.faction !== "countermeasure") {
    return invalid(
      "factionはdisasterまたはcountermeasureで指定してください。",
      "/faction",
    );
  }
  if (!Array.isArray(input.cardDefinitionIds)) {
    return invalid(
      "cardDefinitionIdsは配列で指定してください。",
      "/cardDefinitionIds",
    );
  }
  for (let index = 0; index < input.cardDefinitionIds.length; index += 1) {
    const cardDefinitionId = input.cardDefinitionIds[index];
    if (
      typeof cardDefinitionId !== "string" ||
      cardDefinitionId.trim().length === 0
    ) {
      return invalid(
        "cardDefinitionIdsの各要素は空でない文字列で指定してください。",
        `/cardDefinitionIds/${index}`,
      );
    }
  }

  return {
    parsed: true,
    request: {
      name: input.name.trim(),
      faction: input.faction,
      cardDefinitionIds: [...input.cardDefinitionIds],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid<T>(message: string, path: string): ParseDeckRequestResult<T> {
  return {
    parsed: false,
    errors: [{ code: "INVALID_DECK_REQUEST", message, path }],
  };
}
