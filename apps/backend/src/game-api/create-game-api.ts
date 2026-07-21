import { Hono } from "hono";
import {
  parseSubmitGameCommandRequest,
  type AuthenticatedGameCommand,
  type GameHttpApiErrorResponse,
  type GameSnapshotResponse,
  type SubmitGameCommandResponse,
} from "@disastar/contracts/game";
import type { GameId, PlayerId } from "@disastar/game-engine/contracts";

type GameApiEnvironment = {
  Bindings: CloudflareBindings;
  Variables: {
    authenticatedPlayerId: PlayerId;
  };
};

/** 実際の認証方式に依存しない、ゲーム API の認証境界。 */
export type GameRequestAuthenticator = (
  request: Request,
) => Promise<PlayerId | null>;

type GameSessionRpc = {
  getSnapshot(
    viewerPlayerId: PlayerId,
    afterSequence?: number,
  ): Promise<GameSnapshotResponse>;
  submit(
    authenticatedCommand: AuthenticatedGameCommand,
  ): Promise<SubmitGameCommandResponse>;
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
    const authenticatedPlayerId = await authenticate(c.req.raw);
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

    const response = await getGameSession(
      c.req.param("gameId"),
      c.env,
    ).getSnapshot(c.var.authenticatedPlayerId, afterSequence);
    return c.json(response);
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

    const response = await getGameSession(gameId, c.env).submit({
      authenticatedPlayerId: c.var.authenticatedPlayerId,
      receivedAt: now(),
      command: parsed.request.command,
    });
    return c.json(response);
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
