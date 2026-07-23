import { Hono, type Context } from "hono";
import {
  parseSubmitGameCommandRequest,
  type AuthenticatedGameCommand,
  type GameHttpApiErrorResponse,
} from "@disastar/contracts/game";
import type { GameId, PlayerId } from "@disastar/game-engine/contracts";
import type {
  GetGameSnapshotResult,
  SubmitGameCommandResult,
} from "../game-session/game-session.js";
import type {
  BetterAuthEnvironment,
  RequestAuthenticator,
} from "../auth/request-authenticator.js";

type GameApiEnvironment = {
  Bindings: BetterAuthEnvironment;
  Variables: {
    authenticatedPlayerId: PlayerId;
  };
};

/** 実際の認証方式に依存しない、ゲーム API の認証境界。 */
export type GameRequestAuthenticator = RequestAuthenticator;

type GameSessionRpc = {
  getSnapshot(
    viewerPlayerId: PlayerId,
    afterSequence?: number,
  ): Promise<GetGameSnapshotResult>;
  submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResult>;
  fetch?(request: Request): Promise<Response>;
};

type GameSessionResolver = (
  gameId: GameId,
  environment: CloudflareBindings,
) => GameSessionRpc;

export type GameApiDependencies = {
  authenticate: GameRequestAuthenticator;
  getGameSession?: GameSessionResolver;
  now?: () => number;
};

export function createGameApi({
  authenticate,
  getGameSession = resolveGameSession,
  now = Date.now,
}: GameApiDependencies): Hono<GameApiEnvironment> {
  const api = new Hono<GameApiEnvironment>();

  api.use("*", async (c, next) => {
    const authenticatedPlayerId = await authenticate(c.req.raw, c.env);
    if (authenticatedPlayerId === null) {
      return c.json(
        {
          error: { code: "UNAUTHENTICATED" },
        } satisfies GameHttpApiErrorResponse,
        401,
      );
    }

    c.set("authenticatedPlayerId", authenticatedPlayerId);
    await next();
  });

  api.get("/:gameId", async (c) => {
    const afterSequence = parseAfterSequence(c.req.query("afterSequence"));
    if (afterSequence === null) {
      return c.json(
        {
          error: { code: "INVALID_AFTER_SEQUENCE" },
        } satisfies GameHttpApiErrorResponse,
        400,
      );
    }

    const result = await getGameSession(
      c.req.param("gameId"),
      c.env,
    ).getSnapshot(c.var.authenticatedPlayerId, afterSequence);
    return result.found
      ? c.json(result.snapshot)
      : gameSessionError(c, result.error.code);
  });

  api.get("/:gameId/events", async (c) => {
    if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
      return c.json(
        {
          error: { code: "WEBSOCKET_UPGRADE_REQUIRED" },
        } satisfies GameHttpApiErrorResponse,
        426,
      );
    }

    const headers = new Headers(c.req.raw.headers);
    headers.set(
      "X-Disastar-Authenticated-Player-Id",
      c.var.authenticatedPlayerId,
    );
    const session = getGameSession(c.req.param("gameId"), c.env);
    if (session.fetch === undefined) {
      throw new Error(
        "GameSession Durable Object はWebSocketを処理できません。",
      );
    }
    return await session.fetch(new Request(c.req.raw, { headers }));
  });

  api.post("/:gameId/commands", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: { code: "INVALID_REQUEST" },
        } satisfies GameHttpApiErrorResponse,
        400,
      );
    }

    const parsed = parseSubmitGameCommandRequest(body);
    if (!parsed.parsed) {
      return c.json(
        {
          error: { code: "INVALID_REQUEST" },
          errors: parsed.errors,
        } satisfies GameHttpApiErrorResponse,
        400,
      );
    }

    const gameId = c.req.param("gameId");
    if (parsed.request.command.gameId !== gameId) {
      return c.json(
        {
          error: { code: "GAME_ID_MISMATCH" },
        } satisfies GameHttpApiErrorResponse,
        400,
      );
    }
    if (parsed.request.command.playerId !== c.var.authenticatedPlayerId) {
      return c.json(
        {
          error: { code: "AUTHENTICATED_PLAYER_MISMATCH" },
        } satisfies GameHttpApiErrorResponse,
        403,
      );
    }

    const result = await getGameSession(gameId, c.env).submit({
      authenticatedPlayerId: c.var.authenticatedPlayerId,
      receivedAt: now(),
      command: parsed.request.command,
    });
    return result.submitted
      ? c.json(result.response)
      : gameSessionError(c, result.error.code);
  });

  return api;
}

function resolveGameSession(
  gameId: GameId,
  environment: CloudflareBindings,
): GameSessionRpc {
  return environment.GAME_SESSION.getByName(
    gameId,
  ) as unknown as GameSessionRpc;
}

function parseAfterSequence(value: string | undefined): number | null {
  if (value === undefined) {
    return 0;
  }
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function gameSessionError(
  context: Context<GameApiEnvironment>,
  code:
    | "GAME_NOT_FOUND"
    | "GAME_ACCESS_FORBIDDEN"
    | "AUTHENTICATED_PLAYER_MISMATCH"
    | "COMMAND_ID_CONFLICT",
): Response {
  const status =
    code === "GAME_NOT_FOUND"
      ? 404
      : code === "COMMAND_ID_CONFLICT"
        ? 409
        : 403;
  return context.json(
    { error: { code } } satisfies GameHttpApiErrorResponse,
    status,
  );
}
