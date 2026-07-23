import { createAuthWithDatabase } from "./src/auth/create-auth.js";
import { migrationDatabase } from "./src/db/migration.js";

export const auth = createAuthWithDatabase({
  database: migrationDatabase,
  baseURL: "http://localhost:5173",
  googleClientId: "schema-generation-only-google-client-id",
  googleClientSecret: "schema-generation-only-google-client-secret",
  secret: "schema-generation-only-secret-do-not-deploy",
  trustedOrigins: ["http://localhost:5173"],
});

export default auth;
