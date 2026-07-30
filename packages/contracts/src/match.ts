import type {
  Faction,
  GameId,
  PlayerId,
} from "@disastar/game-engine/contracts";
import type { DeckId } from "./deck.js";

export type { DeckId } from "./deck.js";

export type MatchLobbyStatus = "waiting" | "starting" | "started" | "cancelled";

/** 作成者以外が待機部屋を見つける方法。 */
export type MatchVisibility = "invite" | "public";

/** 参加者にだけ返す、招待式対戦待機部屋の公開状態。 */
export type MatchLobbyView = {
  status: MatchLobbyStatus;
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  opponentPlayerId: PlayerId | null;
  opponentFaction: Faction | null;
  gameId: GameId | null;
};

export type CreateMatchRequest = {
  deckId: DeckId;
  /** 未指定時は従来どおり招待専用で作成する。 */
  visibility?: MatchVisibility;
};

/** 入力を検証して既定値を補完した後の、作成処理向けリクエスト。 */
export type ParsedCreateMatchRequest = {
  deckId: DeckId;
  visibility: MatchVisibility;
};
export type AcceptMatchRequest = { deckId: DeckId };

/** 作成者の識別子を含まない、公開待機部屋一覧用のDTO。 */
export type PublicMatchLobbySummary = {
  matchId: string;
  ownerFaction: Faction;
  createdAt: number;
  expiresAt: number;
  isOwner: boolean;
};

export type ListPublicMatchesResponse = {
  matches: PublicMatchLobbySummary[];
};

export type MatchRequestParseError = {
  code: "INVALID_MATCH_REQUEST";
  message: string;
  path: string;
};

export type ParseMatchRequestResult<T> =
  | { parsed: true; request: T }
  | { parsed: false; errors: MatchRequestParseError[] };

export function parseCreateMatchRequest(
  input: unknown,
): ParseMatchRequestResult<ParsedCreateMatchRequest> {
  if (!isRecord(input)) {
    return invalid(
      "リクエスト本文はJSONオブジェクトでなければなりません。",
      "",
    );
  }
  const keys = Object.keys(input);
  if (
    keys.some((key) => key !== "deckId" && key !== "visibility") ||
    !keys.includes("deckId")
  ) {
    return invalid(
      "リクエスト本文にはdeckIdと任意のvisibilityだけを含めてください。",
      "",
    );
  }
  if (typeof input.deckId !== "string" || input.deckId.trim().length === 0) {
    return invalid("deckIdは空でない文字列で指定してください。", "/deckId");
  }
  if (
    input.visibility !== undefined &&
    input.visibility !== "invite" &&
    input.visibility !== "public"
  ) {
    return invalid(
      "visibilityはinviteまたはpublicで指定してください。",
      "/visibility",
    );
  }

  return {
    parsed: true,
    request: {
      deckId: input.deckId,
      visibility: input.visibility ?? "invite",
    },
  };
}

export function parseAcceptMatchRequest(
  input: unknown,
): ParseMatchRequestResult<AcceptMatchRequest> {
  return parseDeckRequest(input);
}

export type CreateMatchResponse = { matchId: string };

export type MatchAcceptedResponse = { accepted: true; gameId: GameId };
export type MatchRejectedResponse = {
  accepted: false;
  error: { code: MatchApiErrorCode };
};
export type AcceptMatchResponse = MatchAcceptedResponse | MatchRejectedResponse;

export type CancelMatchResponse =
  | { cancelled: true }
  | { cancelled: false; error: { code: MatchApiErrorCode } };

export type MatchApiErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_REQUEST"
  | "DECK_NOT_FOUND"
  | "MATCH_NOT_FOUND"
  | "MATCH_ACCESS_FORBIDDEN"
  | "CANNOT_ACCEPT_OWN_MATCH"
  | "MATCH_NOT_ACCEPTING"
  | "MATCH_FACTION_CONFLICT"
  | "MATCH_CANCELLATION_FORBIDDEN"
  | "MATCH_NOT_CANCELLABLE"
  | "GAME_CREATION_FAILED"
  | "MATCH_CREATION_FAILED";

export type MatchApiErrorResponse = {
  error: { code: MatchApiErrorCode };
  errors?: MatchRequestParseError[];
};

function parseDeckRequest(
  input: unknown,
): ParseMatchRequestResult<{ deckId: DeckId }> {
  if (!isRecord(input)) {
    return invalid(
      "リクエスト本文はJSONオブジェクトでなければなりません。",
      "",
    );
  }
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "deckId") {
    return invalid("リクエスト本文にはdeckIdだけを含めてください。", "");
  }
  if (typeof input.deckId !== "string" || input.deckId.trim().length === 0) {
    return invalid("deckIdは空でない文字列で指定してください。", "/deckId");
  }

  return { parsed: true, request: { deckId: input.deckId } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid<T>(message: string, path: string): ParseMatchRequestResult<T> {
  return {
    parsed: false,
    errors: [{ code: "INVALID_MATCH_REQUEST", message, path }],
  };
}
