import { Hono } from "hono";
import { HEALTH_STATUS, type HealthResponse } from "@disastar/contracts/health";

export { GameSession } from "./game-session/game-session.js";

const app = new Hono();

app.get("/api/health", (c) => {
  const response: HealthResponse = { status: HEALTH_STATUS };

  return c.json(response);
});

export default app;
