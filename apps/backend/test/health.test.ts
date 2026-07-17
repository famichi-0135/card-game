import { describe, expect, it } from "vitest";
import { HEALTH_STATUS, type HealthResponse } from "@disastar/contracts/health";
import worker from "../src";

describe("GET /api/health", () => {
  it("returns the shared health response", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/api/health"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as HealthResponse;

    expect(body).toEqual({ status: HEALTH_STATUS });
  });
});
