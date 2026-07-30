import { desc, eq, gt, lte } from "drizzle-orm";
import type { Faction, PlayerId } from "@disastar/game-engine/contracts";
import { createRuntimeDatabase } from "../db/runtime.js";
import { publicMatchLobby } from "../db/schema/public-match-lobby.js";

const PUBLIC_MATCH_LIST_LIMIT = 20;

export type PublicMatchLobbyIndexEntry = {
  matchId: string;
  ownerPlayerId: PlayerId;
  ownerFaction: Faction;
  createdAt: number;
  expiresAt: number;
};

/**
 * D1は公開待機部屋の検索候補だけを保持する。
 * 参加できるかどうかは呼び出し側がMatchLobbyへ再確認する。
 */
export type PublicMatchLobbyIndex = {
  publish(entry: PublicMatchLobbyIndexEntry): Promise<void>;
  list(now: number): Promise<readonly PublicMatchLobbyIndexEntry[]>;
  remove(matchId: string): Promise<void>;
};

export function createPublicMatchLobbyIndex(
  databaseBinding: D1Database,
): PublicMatchLobbyIndex {
  const database = createRuntimeDatabase(databaseBinding);

  return {
    async publish(entry) {
      await database
        .insert(publicMatchLobby)
        .values({
          matchId: entry.matchId,
          ownerPlayerId: entry.ownerPlayerId,
          ownerFaction: entry.ownerFaction,
          createdAt: new Date(entry.createdAt),
          expiresAt: new Date(entry.expiresAt),
        })
        .onConflictDoNothing();
    },
    async list(now) {
      const currentTime = new Date(now);
      await database
        .delete(publicMatchLobby)
        .where(lte(publicMatchLobby.expiresAt, currentTime));
      const entries = await database
        .select()
        .from(publicMatchLobby)
        .where(gt(publicMatchLobby.expiresAt, currentTime))
        .orderBy(desc(publicMatchLobby.createdAt))
        .limit(PUBLIC_MATCH_LIST_LIMIT);

      return entries.map((entry) => ({
        matchId: entry.matchId,
        ownerPlayerId: entry.ownerPlayerId,
        ownerFaction: entry.ownerFaction,
        createdAt: entry.createdAt.getTime(),
        expiresAt: entry.expiresAt.getTime(),
      }));
    },
    async remove(matchId) {
      await database
        .delete(publicMatchLobby)
        .where(eq(publicMatchLobby.matchId, matchId));
    },
  };
}
