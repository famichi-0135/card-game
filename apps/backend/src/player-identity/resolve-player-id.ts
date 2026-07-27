import { eq } from "drizzle-orm";
import type { PlayerId } from "@disastar/game-engine/contracts";
import { createRuntimeDatabase, type RuntimeDatabase } from "../db/runtime.js";
import { playerIdentity } from "../db/schema/player-identity.js";

/**
 * 認証利用者に対応するゲーム用の固定PlayerIdを返す。
 *
 * 既存のGoogle利用者にはauthUserId自身を初期値として保存するため、既存の
 * Durable Object名と保存済みデータを移行せずに継続できる。
 */
export async function resolvePlayerIdForAuthUser(
  database: D1Database,
  authUserId: string,
): Promise<PlayerId> {
  return resolvePlayerIdForAuthUserInDatabase(
    createRuntimeDatabase(database),
    authUserId,
  );
}

export async function linkAnonymousPlayerIdentity(
  database: D1Database,
  input: {
    anonymousAuthUserId: string;
    newAuthUserId: string;
  },
): Promise<void> {
  await linkAnonymousPlayerIdentityInDatabase(
    createRuntimeDatabase(database),
    input,
  );
}

export async function linkAnonymousPlayerIdentityInDatabase(
  database: RuntimeDatabase,
  {
    anonymousAuthUserId,
    newAuthUserId,
  }: {
    anonymousAuthUserId: string;
    newAuthUserId: string;
  },
): Promise<void> {
  const anonymousPlayerId = await resolvePlayerIdForAuthUserInDatabase(
    database,
    anonymousAuthUserId,
  );
  const [newIdentity] = await database
    .select({ playerId: playerIdentity.playerId })
    .from(playerIdentity)
    .where(eq(playerIdentity.authUserId, newAuthUserId));

  if (newIdentity !== undefined) {
    if (newIdentity.playerId === anonymousPlayerId) {
      return;
    }
    throw new PlayerIdentityLinkConflictError();
  }

  await database
    .update(playerIdentity)
    .set({ authUserId: newAuthUserId })
    .where(eq(playerIdentity.authUserId, anonymousAuthUserId));

  const [linkedIdentity] = await database
    .select({ playerId: playerIdentity.playerId })
    .from(playerIdentity)
    .where(eq(playerIdentity.authUserId, newAuthUserId));

  if (linkedIdentity?.playerId !== anonymousPlayerId) {
    throw new Error("Player identity could not be linked");
  }
}

export class PlayerIdentityLinkConflictError extends Error {
  constructor() {
    super("The destination auth user already has a different player identity");
    this.name = "PlayerIdentityLinkConflictError";
  }
}

async function resolvePlayerIdForAuthUserInDatabase(
  runtimeDatabase: RuntimeDatabase,
  authUserId: string,
): Promise<PlayerId> {
  await runtimeDatabase
    .insert(playerIdentity)
    .values({
      authUserId,
      playerId: authUserId,
    })
    .onConflictDoNothing();

  const [identity] = await runtimeDatabase
    .select({ playerId: playerIdentity.playerId })
    .from(playerIdentity)
    .where(eq(playerIdentity.authUserId, authUserId));

  if (identity === undefined) {
    throw new Error("Player identity could not be resolved");
  }

  return identity.playerId;
}
