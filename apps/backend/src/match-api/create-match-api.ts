import { Hono, type Context } from "hono";
import {
  parseAcceptMatchRequest,
  parseCreateMatchRequest,
  type AcceptMatchResponse,
  type CancelMatchResponse,
  type CreateMatchResponse,
  type ListPublicMatchesResponse,
  type MatchApiErrorCode,
  type MatchApiErrorResponse,
  type MatchLobbyView,
} from "@disastar/contracts/match";
import type {
  CardDefinitionId,
  Faction,
  PlayerId,
} from "@disastar/game-engine/contracts";
import {
  createMatchLobbyInEnvironment,
  MATCH_LOBBY_WAIT_DURATION_MS,
  type CreateMatchLobbyInput,
  type CreateMatchLobbyResult,
  type GetMatchLobbyViewResult,
  type MatchLobbyAcceptResult,
  type MatchLobbyCancelResult,
} from "../match-lobby/match-lobby.js";
import {
  createPublicMatchLobbyIndex,
  type PublicMatchLobbyIndex,
} from "../match-lobby/public-match-lobby-index.js";
import type {
  BetterAuthEnvironment,
  RequestAuthenticator,
} from "../auth/request-authenticator.js";

type MatchApiEnvironment = {
  Bindings: BetterAuthEnvironment;
  Variables: { authenticatedPlayerId: PlayerId };
};

/** 実際の認証方式に依存しない、対戦待機 API の認証境界。 */
export type MatchRequestAuthenticator = RequestAuthenticator;

/** 保存済みデッキの所有権を確認し、ゲーム初期化に渡すカード定義IDを返す。 */
export type AuthorizedDeckResolver = (
  playerId: PlayerId,
  deckId: string,
  environment: CloudflareBindings,
) => Promise<{
  faction: Faction;
  cardDefinitionIds: CardDefinitionId[];
} | null>;

type MatchLobbyRpc = {
  getView(viewerPlayerId: PlayerId): Promise<GetMatchLobbyViewResult>;
  getPublicSummary?(): Promise<
    | {
        available: true;
        summary: {
          ownerFaction: Faction;
          createdAt: number;
          expiresAt: number;
        };
      }
    | { available: false }
  >;
  accept(input: {
    playerId: PlayerId;
    faction: Faction;
    deckDefinitionIds: CardDefinitionId[];
  }): Promise<MatchLobbyAcceptResult>;
  cancel(playerId: PlayerId): Promise<MatchLobbyCancelResult>;
};

type MatchLobbyResolver = (
  matchId: string,
  environment: CloudflareBindings,
) => MatchLobbyRpc;

type MatchLobbyCreator = (
  input: CreateMatchLobbyInput,
  environment: CloudflareBindings,
  now?: () => number,
) => Promise<CreateMatchLobbyResult>;

export type MatchApiDependencies = {
  authenticate: MatchRequestAuthenticator;
  resolveAuthorizedDeck: AuthorizedDeckResolver;
  getMatchLobby?: MatchLobbyResolver;
  createMatchLobby?: MatchLobbyCreator;
  publicMatchLobbyIndex?: PublicMatchLobbyIndex;
  now?: () => number;
};

export function createMatchApi({
  authenticate,
  resolveAuthorizedDeck,
  getMatchLobby = resolveMatchLobby,
  createMatchLobby = createMatchLobbyInEnvironment,
  publicMatchLobbyIndex,
  now = Date.now,
}: MatchApiDependencies): Hono<MatchApiEnvironment> {
  const api = new Hono<MatchApiEnvironment>();

  api.use("*", async (c, next) => {
    const authenticatedPlayerId = await authenticate(c.req.raw, c.env);
    if (authenticatedPlayerId === null) {
      return c.json(
        { error: { code: "UNAUTHENTICATED" } } satisfies MatchApiErrorResponse,
        401,
      );
    }
    c.set("authenticatedPlayerId", authenticatedPlayerId);
    await next();
  });

  api.post("/", async (c) => {
    const parsed = await parseRequest(c.req.raw, parseCreateMatchRequest);
    if (!parsed.parsed) {
      return c.json(
        {
          error: { code: "INVALID_REQUEST" },
          errors: parsed.errors,
        } satisfies MatchApiErrorResponse,
        400,
      );
    }
    const deck = await resolveAuthorizedDeck(
      c.var.authenticatedPlayerId,
      parsed.request.deckId,
      c.env,
    );
    if (deck === null) {
      return matchError(c, "DECK_NOT_FOUND", 404);
    }

    const createdAt = now();
    const created = await createMatchLobby(
      {
        ownerPlayerId: c.var.authenticatedPlayerId,
        ownerFaction: deck.faction,
        ownerDeckDefinitionIds: deck.cardDefinitionIds,
        visibility: parsed.request.visibility,
      },
      c.env,
      () => createdAt,
    );
    if (!created.created) {
      return matchError(c, "MATCH_CREATION_FAILED", 500);
    }
    if (parsed.request.visibility === "public") {
      const index = getPublicMatchLobbyIndex(c.env, publicMatchLobbyIndex);
      try {
        await index.publish({
          matchId: created.matchId,
          ownerPlayerId: c.var.authenticatedPlayerId,
          ownerFaction: deck.faction,
          createdAt,
          expiresAt: createdAt + MATCH_LOBBY_WAIT_DURATION_MS,
        });
      } catch {
        await cancelCreatedLobby(
          created.matchId,
          c.var.authenticatedPlayerId,
          c.env,
          getMatchLobby,
        );
        return matchError(c, "MATCH_CREATION_FAILED", 500);
      }
    }
    return c.json(
      { matchId: created.matchId } satisfies CreateMatchResponse,
      201,
    );
  });

  api.get("/", async (c) => {
    const index = getPublicMatchLobbyIndex(c.env, publicMatchLobbyIndex);
    const entries = await index.list(now());
    const matches = await Promise.all(
      entries.map(async (entry) => {
        const lobby = tryResolveMatchLobby(entry.matchId, c.env, getMatchLobby);
        if (lobby === null) {
          await removePublicLobby(index, entry.matchId);
          return null;
        }
        const result = await lobby.getPublicSummary?.();
        if (
          result === undefined ||
          !result.available ||
          result.summary.ownerFaction !== entry.ownerFaction ||
          result.summary.createdAt !== entry.createdAt ||
          result.summary.expiresAt !== entry.expiresAt
        ) {
          await removePublicLobby(index, entry.matchId);
          return null;
        }
        return {
          matchId: entry.matchId,
          ownerFaction: result.summary.ownerFaction,
          createdAt: result.summary.createdAt,
          expiresAt: result.summary.expiresAt,
          isOwner: entry.ownerPlayerId === c.var.authenticatedPlayerId,
        };
      }),
    );

    return c.json({
      matches: matches.filter((match) => match !== null),
    } satisfies ListPublicMatchesResponse);
  });

  api.get("/:matchId", async (c) => {
    const lobby = tryResolveMatchLobby(
      c.req.param("matchId"),
      c.env,
      getMatchLobby,
    );
    if (lobby === null) {
      return matchError(c, "MATCH_NOT_FOUND", 404);
    }
    const result = await lobby.getView(c.var.authenticatedPlayerId);
    if (!result.visible) {
      return matchError(
        c,
        result.error.code,
        statusForMatchError(result.error.code),
      );
    }
    return c.json({ match: result.view } satisfies { match: MatchLobbyView });
  });

  api.post("/:matchId/accept", async (c) => {
    const parsed = await parseRequest(c.req.raw, parseAcceptMatchRequest);
    if (!parsed.parsed) {
      return c.json(
        {
          error: { code: "INVALID_REQUEST" },
          errors: parsed.errors,
        } satisfies MatchApiErrorResponse,
        400,
      );
    }
    const deck = await resolveAuthorizedDeck(
      c.var.authenticatedPlayerId,
      parsed.request.deckId,
      c.env,
    );
    if (deck === null) {
      return matchError(c, "DECK_NOT_FOUND", 404);
    }
    const lobby = tryResolveMatchLobby(
      c.req.param("matchId"),
      c.env,
      getMatchLobby,
    );
    if (lobby === null) {
      return matchError(c, "MATCH_NOT_FOUND", 404);
    }
    const result = await lobby.accept({
      playerId: c.var.authenticatedPlayerId,
      faction: deck.faction,
      deckDefinitionIds: deck.cardDefinitionIds,
    });
    if (result.accepted) {
      await removePublicLobby(
        getPublicMatchLobbyIndex(c.env, publicMatchLobbyIndex),
        c.req.param("matchId"),
      );
      return c.json({
        accepted: true,
        gameId: result.gameId,
      } satisfies AcceptMatchResponse);
    }
    return c.json(
      {
        accepted: false,
        error: { code: result.error.code },
      } satisfies AcceptMatchResponse,
      statusForMatchError(result.error.code),
    );
  });

  api.post("/:matchId/cancel", async (c) => {
    const lobby = tryResolveMatchLobby(
      c.req.param("matchId"),
      c.env,
      getMatchLobby,
    );
    if (lobby === null) {
      return matchError(c, "MATCH_NOT_FOUND", 404);
    }
    const result = await lobby.cancel(c.var.authenticatedPlayerId);
    if (result.cancelled) {
      await removePublicLobby(
        getPublicMatchLobbyIndex(c.env, publicMatchLobbyIndex),
        c.req.param("matchId"),
      );
      return c.json({ cancelled: true } satisfies CancelMatchResponse);
    }
    return c.json(
      {
        cancelled: false,
        error: { code: result.error.code },
      } satisfies CancelMatchResponse,
      statusForMatchError(result.error.code),
    );
  });

  return api;
}

function resolveMatchLobby(
  matchId: string,
  environment: CloudflareBindings,
): MatchLobbyRpc {
  return environment.MATCH_LOBBY.get(
    environment.MATCH_LOBBY.idFromString(matchId),
  ) as unknown as MatchLobbyRpc;
}

function tryResolveMatchLobby(
  matchId: string,
  environment: CloudflareBindings,
  resolver: MatchLobbyResolver,
): MatchLobbyRpc | null {
  try {
    return resolver(matchId, environment);
  } catch {
    return null;
  }
}

function getPublicMatchLobbyIndex(
  environment: CloudflareBindings,
  providedIndex: PublicMatchLobbyIndex | undefined,
): PublicMatchLobbyIndex {
  return providedIndex ?? createPublicMatchLobbyIndex(environment.DB);
}

async function cancelCreatedLobby(
  matchId: string,
  playerId: PlayerId,
  environment: CloudflareBindings,
  resolver: MatchLobbyResolver,
): Promise<void> {
  const lobby = tryResolveMatchLobby(matchId, environment, resolver);
  if (lobby === null) {
    return;
  }
  try {
    await lobby.cancel(playerId);
  } catch {
    // D1登録に失敗した公開部屋は一覧に載らない。取消は補償処理として最善で試みる。
  }
}

async function removePublicLobby(
  index: PublicMatchLobbyIndex,
  matchId: string,
): Promise<void> {
  try {
    await index.remove(matchId);
  } catch {
    // D1索引が遅れても、MatchLobbyの状態再検証で参加済み・取消済みの部屋は返さない。
  }
}

async function parseRequest<T>(
  request: Request,
  parse: (
    input: unknown,
  ) =>
    | { parsed: true; request: T }
    | { parsed: false; errors: MatchApiErrorResponse["errors"] },
): Promise<
  | { parsed: true; request: T }
  | { parsed: false; errors: MatchApiErrorResponse["errors"] }
> {
  try {
    return parse(await request.json());
  } catch {
    return {
      parsed: false,
      errors: [
        {
          code: "INVALID_MATCH_REQUEST",
          message: "リクエスト本文はJSONとして解析できません。",
          path: "",
        },
      ],
    };
  }
}

function matchError(
  context: Context<MatchApiEnvironment>,
  code: MatchApiErrorCode,
  status: 400 | 403 | 404 | 409 | 422 | 500,
): Response {
  return context.json(
    { error: { code } } satisfies MatchApiErrorResponse,
    status,
  );
}

function statusForMatchError(code: MatchApiErrorCode): 403 | 404 | 409 | 422 {
  switch (code) {
    case "MATCH_ACCESS_FORBIDDEN":
    case "MATCH_CANCELLATION_FORBIDDEN":
      return 403;
    case "MATCH_NOT_FOUND":
      return 404;
    case "GAME_CREATION_FAILED":
      return 422;
    default:
      return 409;
  }
}
