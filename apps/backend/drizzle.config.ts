import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const token = process.env.CLOUDFLARE_D1_TOKEN;
const remoteCredentials =
  accountId && databaseId && token
    ? {
        driver: "d1-http" as const,
        dbCredentials: { accountId, databaseId, token },
      }
    : {};

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/auth.ts",
  out: "./drizzle",
  ...remoteCredentials,
});
