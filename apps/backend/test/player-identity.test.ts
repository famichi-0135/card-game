import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  PlayerIdentityLinkConflictError,
  linkAnonymousPlayerIdentity,
  resolvePlayerIdForAuthUser,
} from "../src/player-identity/resolve-player-id.js";
import { createRuntimeDatabase } from "../src/db/runtime.js";
import { playerIdentity } from "../src/db/schema/player-identity.js";

describe("ゲーム用PlayerIdの引き継ぎ", () => {
  it("匿名利用者をGoogle利用者へ引き継いでもPlayerIdを変えない", async () => {
    const anonymousAuthUserId = crypto.randomUUID();
    const googleAuthUserId = crypto.randomUUID();
    const anonymousPlayerId = await resolvePlayerIdForAuthUser(
      env.DB,
      anonymousAuthUserId,
    );

    await linkAnonymousPlayerIdentity(env.DB, {
      anonymousAuthUserId,
      newAuthUserId: googleAuthUserId,
    });

    await expect(
      resolvePlayerIdForAuthUser(env.DB, googleAuthUserId),
    ).resolves.toBe(anonymousPlayerId);

    const database = createRuntimeDatabase(env.DB);
    await expect(
      database
        .select()
        .from(playerIdentity)
        .where(eq(playerIdentity.authUserId, anonymousAuthUserId)),
    ).resolves.toEqual([]);
  });

  it("既に別のPlayerIdを持つGoogle利用者とは自動統合しない", async () => {
    const anonymousAuthUserId = crypto.randomUUID();
    const googleAuthUserId = crypto.randomUUID();
    const anonymousPlayerId = await resolvePlayerIdForAuthUser(
      env.DB,
      anonymousAuthUserId,
    );
    const googlePlayerId = await resolvePlayerIdForAuthUser(
      env.DB,
      googleAuthUserId,
    );

    await expect(
      linkAnonymousPlayerIdentity(env.DB, {
        anonymousAuthUserId,
        newAuthUserId: googleAuthUserId,
      }),
    ).rejects.toBeInstanceOf(PlayerIdentityLinkConflictError);

    await expect(
      resolvePlayerIdForAuthUser(env.DB, anonymousAuthUserId),
    ).resolves.toBe(anonymousPlayerId);
    await expect(
      resolvePlayerIdForAuthUser(env.DB, googleAuthUserId),
    ).resolves.toBe(googlePlayerId);
  });
});
