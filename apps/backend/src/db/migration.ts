import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index.js";

// Better Auth CLI inspects this adapter without issuing queries.
const migrationClient = {} as D1Database;

export const migrationDatabase = drizzle(migrationClient, { schema });
