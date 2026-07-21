import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index.js";

export function createRuntimeDatabase(database: D1Database) {
  return drizzle(database, { schema });
}

export type RuntimeDatabase = ReturnType<typeof createRuntimeDatabase>;
