import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Better Authの利用者と、対戦データの所有者を結び付ける対応表。
 *
 * authUserIdに外部キーを付けない。匿名利用者をGoogleアカウントへ引き継ぐ際に
 * Better Authが匿名のuser行を削除しても、ゲーム用playerIdを維持するためである。
 */
export const playerIdentity = sqliteTable("player_identity", {
  playerId: text("player_id").primaryKey(),
  authUserId: text("auth_user_id").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
