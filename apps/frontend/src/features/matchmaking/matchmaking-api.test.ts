import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelMatchOnPageExit,
  createMatch,
  listPublicMatches,
} from "./matchmaking-api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("公開待機部屋API", () => {
  it("公開指定で待機部屋を作成する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ matchId: "match-1" }));
    globalThis.fetch = fetchMock;

    await expect(createMatch("deck-1", "public")).resolves.toBe("match-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/matches", {
      body: JSON.stringify({ deckId: "deck-1", visibility: "public" }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("公開部屋一覧は作成者の識別子を要求しない", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        matches: [
          {
            matchId: "match-1",
            ownerFaction: "disaster",
            createdAt: 1_000,
            expiresAt: 1_801_000,
            isOwner: false,
          },
        ],
      }),
    );
    globalThis.fetch = fetchMock;

    await expect(listPublicMatches()).resolves.toEqual([
      {
        matchId: "match-1",
        ownerFaction: "disaster",
        createdAt: 1_000,
        expiresAt: 1_801_000,
        isOwner: false,
      },
    ]);
  });

  it("待機画面から離れるとkeepalive付き取消要求を送る", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ cancelled: true }));
    globalThis.fetch = fetchMock;

    cancelMatchOnPageExit("match-1");
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("/api/matches/match-1/cancel", {
      credentials: "include",
      headers: { Accept: "application/json" },
      keepalive: true,
      method: "POST",
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
