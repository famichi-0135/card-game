import type {
  CreateStarterDeckResponse,
  DeckApiErrorCode,
  ListDecksResponse,
  SavedDeckView,
} from "@disastar/contracts/deck";
import type {
  AcceptMatchResponse,
  CreateMatchResponse,
  MatchApiErrorCode,
  MatchLobbyView,
} from "@disastar/contracts/match";
import type { Faction } from "@disastar/game-engine/contracts";

export class MatchmakingApiError extends Error {
  readonly code: MatchmakingApiErrorCode;
  readonly status: number;

  constructor(status: number, code: MatchmakingApiErrorCode) {
    super(`Matchmaking request failed: ${status} ${code}`);
    this.name = "MatchmakingApiError";
    this.status = status;
    this.code = code;
  }
}

export async function listDecks(): Promise<readonly SavedDeckView[]> {
  const response = await fetchMatchmakingApi<ListDecksResponse>("/api/decks");
  return response.decks;
}

export async function createStarterDeck(
  faction: Faction,
): Promise<SavedDeckView> {
  const response = await fetchMatchmakingApi<CreateStarterDeckResponse>(
    "/api/decks/starter",
    {
      method: "POST",
      body: JSON.stringify({ faction }),
    },
  );
  return response.deck;
}

export async function createMatch(deckId: string): Promise<string> {
  const response = await fetchMatchmakingApi<CreateMatchResponse>(
    "/api/matches",
    {
      method: "POST",
      body: JSON.stringify({ deckId }),
    },
  );
  return response.matchId;
}

export async function getMatch(matchId: string): Promise<MatchLobbyView> {
  const response = await fetchMatchmakingApi<{ match: MatchLobbyView }>(
    `/api/matches/${encodeURIComponent(matchId)}`,
  );
  return response.match;
}

export async function acceptMatch(
  matchId: string,
  deckId: string,
): Promise<string> {
  const response = await fetchMatchmakingApi<AcceptMatchResponse>(
    `/api/matches/${encodeURIComponent(matchId)}/accept`,
    {
      method: "POST",
      body: JSON.stringify({ deckId }),
    },
  );

  if (!response.accepted) {
    throw new MatchmakingApiError(409, response.error.code);
  }
  return response.gameId;
}

export async function cancelMatch(matchId: string): Promise<void> {
  const response = await fetchMatchmakingApi<{ cancelled: boolean }>(
    `/api/matches/${encodeURIComponent(matchId)}/cancel`,
    { method: "POST" },
  );

  if (!response.cancelled) {
    throw new MatchmakingApiError(409, "MATCH_NOT_CANCELLABLE");
  }
}

export function getMatchmakingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof MatchmakingApiError)) {
    return fallback;
  }

  switch (error.code) {
    case "UNAUTHENTICATED":
      return "ログイン状態を確認できません。もう一度ログインしてください。";
    case "DECK_NOT_FOUND":
      return "選択したデッキが見つかりません。デッキ一覧を更新してください。";
    case "MATCH_NOT_FOUND":
      return "招待部屋が見つかりません。部屋 ID または招待 URL を確認してください。";
    case "MATCH_ACCESS_FORBIDDEN":
      return "この招待部屋を表示する権限がありません。";
    case "MATCH_FACTION_CONFLICT":
      return "作成者と異なる陣営のデッキを選択してください。";
    case "CANNOT_ACCEPT_OWN_MATCH":
      return "自分で作成した招待部屋には参加できません。";
    case "MATCH_NOT_ACCEPTING":
      return "この招待部屋は参加を受け付けていません。";
    case "MATCH_CANCELLATION_FORBIDDEN":
    case "MATCH_NOT_CANCELLABLE":
      return "この招待部屋は取り消せません。";
    case "GAME_CREATION_FAILED":
      return "対戦の開始に失敗しました。しばらくしてからもう一度お試しください。";
    case "MATCH_CREATION_FAILED":
      return "招待部屋を作成できませんでした。しばらくしてからもう一度お試しください。";
    default:
      return fallback;
  }
}

async function fetchMatchmakingApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new MatchmakingApiError(
      response.status,
      getMatchApiErrorCode(payload),
    );
  }

  return payload as T;
}

function getMatchApiErrorCode(payload: unknown): MatchmakingApiErrorCode {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "code" in payload.error &&
    typeof payload.error.code === "string"
  ) {
    return payload.error.code as MatchmakingApiErrorCode;
  }
  return "UNKNOWN";
}

type MatchmakingApiErrorCode = MatchApiErrorCode | DeckApiErrorCode | "UNKNOWN";
