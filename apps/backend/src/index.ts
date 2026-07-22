import { Hono } from "hono";
import { cors } from "hono/cors";
import { HEALTH_STATUS, type HealthResponse } from "@disastar/contracts/health";
import {
  createGameApi,
  type GameRequestAuthenticator,
} from "./game-api/create-game-api.js";
import {
  createMatchApi,
  type AuthorizedDeckResolver,
  type MatchRequestAuthenticator,
} from "./match-api/create-match-api.js";
import {
  createDeckApi,
  type DeckRequestAuthenticator,
} from "./deck-api/create-deck-api.js";
import { resolveAuthorizedDeckInEnvironment } from "./player-decks/resolve-authorized-deck.js";
import {
  authenticateBetterAuthRequest,
  handleBetterAuthRequest,
  parseTrustedOrigins,
  type BetterAuthEnvironment,
} from "./auth/runtime-auth.js";

export { GameSession } from "./game-session/game-session.js";
export { CatalogArchive } from "./catalog-archive/catalog-archive.js";
export { MatchLobby } from "./match-lobby/match-lobby.js";
export { PlayerDecks } from "./player-decks/player-decks.js";

type CreateAppOptions = {
  handleAuthRequest?: typeof handleBetterAuthRequest;
  authenticateGameRequest?: GameRequestAuthenticator;
  authenticateMatchRequest?: MatchRequestAuthenticator;
  authenticateDeckRequest?: DeckRequestAuthenticator;
  resolveAuthorizedDeck?: AuthorizedDeckResolver;
};

export function createApp({
  handleAuthRequest = handleBetterAuthRequest,
  authenticateGameRequest = authenticateBetterAuthRequest,
  authenticateMatchRequest = authenticateBetterAuthRequest,
  authenticateDeckRequest = authenticateBetterAuthRequest,
  resolveAuthorizedDeck = resolveAuthorizedDeckInEnvironment,
}: CreateAppOptions = {}) {
  const app = new Hono<{ Bindings: BetterAuthEnvironment }>();

  app.get("/api/health", (c) => {
    const response: HealthResponse = { status: HEALTH_STATUS };

    return c.json(response);
  });
  app.use(
    "/api/auth/*",
    cors({
      origin: (origin, c) =>
        parseTrustedOrigins(c.env.BETTER_AUTH_TRUSTED_ORIGINS).includes(origin)
          ? origin
          : undefined,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 600,
    }),
  );
  app.on(["GET", "POST"], "/api/auth/*", (c) =>
    handleAuthRequest(c.req.raw, c.env, (task) => {
      c.executionCtx.waitUntil(task);
    }),
  );
  app.route(
    "/api/games",
    createGameApi({ authenticate: authenticateGameRequest }),
  );
  app.route(
    "/api/decks",
    createDeckApi({ authenticate: authenticateDeckRequest }),
  );
  app.route(
    "/api/matches",
    createMatchApi({
      authenticate: authenticateMatchRequest,
      resolveAuthorizedDeck,
    }),
  );

  return app;
}

const app = createApp();

export default app;
