import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createPublicMatchLobbyIndex } from "../src/match-lobby/public-match-lobby-index.js";

describe("公開待機部屋D1インデックス", () => {
  it("期限切れを削除し、募集中の部屋を新しい順で返す", async () => {
    const index = createPublicMatchLobbyIndex(env.DB);
    const now = Date.now();

    await index.publish({
      matchId: `match-active-old-${crypto.randomUUID()}`,
      ownerPlayerId: "player-1",
      ownerFaction: "disaster",
      createdAt: now - 2_000,
      expiresAt: now + 60_000,
    });
    await index.publish({
      matchId: `match-active-new-${crypto.randomUUID()}`,
      ownerPlayerId: "player-2",
      ownerFaction: "countermeasure",
      createdAt: now - 1_000,
      expiresAt: now + 60_000,
    });
    await index.publish({
      matchId: `match-expired-${crypto.randomUUID()}`,
      ownerPlayerId: "player-3",
      ownerFaction: "disaster",
      createdAt: now - 3_000,
      expiresAt: now,
    });

    const matches = await index.list(now);

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchId: expect.stringMatching(/^match-active-old-/),
        }),
        expect.objectContaining({
          matchId: expect.stringMatching(/^match-active-new-/),
        }),
      ]),
    );
    expect(matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchId: expect.stringMatching(/^match-expired-/),
        }),
      ]),
    );
    const activeMatches = matches.filter((match) =>
      match.matchId.startsWith("match-active-"),
    );
    expect(activeMatches.map((match) => match.matchId)).toEqual([
      expect.stringMatching(/^match-active-new-/),
      expect.stringMatching(/^match-active-old-/),
    ]);
  });
});
