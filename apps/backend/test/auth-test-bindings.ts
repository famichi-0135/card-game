import { env } from "cloudflare:test";
import type { BetterAuthEnvironment } from "../src/auth/runtime-auth.js";

export const authTestBaseURL = "https://api.example.test";
export const authTestTrustedOrigin = "https://app.example.test";

const testSecret = "test-only-better-auth-secret-32-chars";

export function createAuthTestBindings(): BetterAuthEnvironment {
  return {
    ...env,
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: authTestBaseURL,
    BETTER_AUTH_TRUSTED_ORIGINS: ` ${authTestTrustedOrigin},${authTestTrustedOrigin} `,
  };
}
