import type { GameId, PlayerId } from "@disastar/game-engine/contracts";

export type MatchLobbyStatus = "waiting" | "starting" | "started" | "cancelled";

/** 参加者にだけ返す、招待式対戦待機部屋の公開状態。 */
export type MatchLobbyView = {
  status: MatchLobbyStatus;
  ownerPlayerId: PlayerId;
  opponentPlayerId: PlayerId | null;
  gameId: GameId | null;
};

/** クライアントが選択する、保存済みデッキの不透明な識別子。 */
export type DeckId = string;

export type CreateMatchRequest = { deckId: DeckId };
export type AcceptMatchRequest = { deckId: DeckId };

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
): ParseMatchRequestResult<CreateMatchRequest> {
  return parseDeckRequest(input);
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
