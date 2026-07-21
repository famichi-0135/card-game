import { Hono } from "hono";
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

export { GameSession } from "./game-session/game-session.js";
export { MatchLobby } from "./match-lobby/match-lobby.js";

type CreateAppOptions = {
  authenticateGameRequest?: GameRequestAuthenticator;
  authenticateMatchRequest?: MatchRequestAuthenticator;
  resolveAuthorizedDeck?: AuthorizedDeckResolver;
};

export function createApp({
  authenticateGameRequest = rejectUnauthenticatedRequest,
  authenticateMatchRequest = rejectUnauthenticatedRequest,
  resolveAuthorizedDeck = rejectUnauthorizedDeck,
}: CreateAppOptions = {}) {
  const app = new Hono<{ Bindings: CloudflareBindings }>();

  app.get("/api/health", (c) => {
    const response: HealthResponse = { status: HEALTH_STATUS };

    return c.json(response);
  });
  app.route(
    "/api/games",
    createGameApi({ authenticate: authenticateGameRequest }),
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

const rejectUnauthenticatedRequest: GameRequestAuthenticator = async () => null;
const rejectUnauthorizedDeck: AuthorizedDeckResolver = async () => null;

const app = createApp();

export default app;
