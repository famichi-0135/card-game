import { Hono, type Context } from "hono";
import {
  parseAcceptMatchRequest,
  parseCreateMatchRequest,
  type AcceptMatchResponse,
  type CancelMatchResponse,
  type CreateMatchResponse,
  type MatchApiErrorCode,
  type MatchApiErrorResponse,
  type MatchLobbyView,
} from "@disastar/contracts/match";
import type {
  CardDefinitionId,
  PlayerId,
} from "@disastar/game-engine/contracts";
import {
  createMatchLobbyInEnvironment,
  type CreateMatchLobbyInput,
  type CreateMatchLobbyResult,
  type GetMatchLobbyViewResult,
  type MatchLobbyAcceptResult,
  type MatchLobbyCancelResult,
} from "../match-lobby/match-lobby.js";
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
) => Promise<CardDefinitionId[] | null>;

type MatchLobbyRpc = {
  getView(viewerPlayerId: PlayerId): Promise<GetMatchLobbyViewResult>;
  accept(input: {
    playerId: PlayerId;
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
  now?: () => number;
};

export function createMatchApi({
  authenticate,
  resolveAuthorizedDeck,
  getMatchLobby = resolveMatchLobby,
  createMatchLobby = createMatchLobbyInEnvironment,
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
    const deckDefinitionIds = await resolveAuthorizedDeck(
      c.var.authenticatedPlayerId,
      parsed.request.deckId,
      c.env,
    );
    if (deckDefinitionIds === null) {
      return matchError(c, "DECK_NOT_FOUND", 404);
    }

    const created = await createMatchLobby(
      {
        ownerPlayerId: c.var.authenticatedPlayerId,
        ownerDeckDefinitionIds: deckDefinitionIds,
      },
      c.env,
      now,
    );
    if (!created.created) {
      return matchError(c, "MATCH_CREATION_FAILED", 500);
    }
    return c.json(
      { matchId: created.matchId } satisfies CreateMatchResponse,
      201,
    );
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
    const deckDefinitionIds = await resolveAuthorizedDeck(
      c.var.authenticatedPlayerId,
      parsed.request.deckId,
      c.env,
    );
    if (deckDefinitionIds === null) {
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
      deckDefinitionIds,
    });
    return result.accepted
      ? c.json({
          accepted: true,
          gameId: result.gameId,
        } satisfies AcceptMatchResponse)
      : c.json(
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
    return result.cancelled
      ? c.json({ cancelled: true } satisfies CancelMatchResponse)
      : c.json(
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
