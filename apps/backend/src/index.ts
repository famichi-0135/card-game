import { Hono } from "hono";
import { HEALTH_STATUS, type HealthResponse } from "@disastar/contracts/health";
import {
  createGameApi,
  type GameRequestAuthenticator,
} from "./game-api/create-game-api.js";

export { GameSession } from "./game-session/game-session.js";

type CreateAppOptions = {
  authenticateGameRequest?: GameRequestAuthenticator;
};

export function createApp({
  authenticateGameRequest = rejectUnauthenticatedRequest,
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

  return app;
}

const rejectUnauthenticatedRequest: GameRequestAuthenticator = async () => null;

const app = createApp();

export default app;
