import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Faction, PlayerId } from "@disastar/game-engine/contracts";

/**
 * 公開待機部屋を検索するためのD1インデックス。
 * 対戦参加の正本はMatchLobby Durable Objectであり、この表だけでは参加を確定しない。
 */
export const publicMatchLobby = sqliteTable(
  "public_match_lobby",
  {
    matchId: text("match_id").primaryKey(),
    ownerPlayerId: text("owner_player_id").$type<PlayerId>().notNull(),
    ownerFaction: text("owner_faction").$type<Faction>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("public_match_lobby_expires_created_idx").on(
      table.expiresAt,
      table.createdAt,
    ),
  ],
);
