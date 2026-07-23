import { env } from "cloudflare:test";
import { makeSignature } from "better-auth/crypto";
import { createRuntimeDatabase } from "../src/db/runtime.js";
import { account, session, user } from "../src/db/schema/auth.js";
import type { BetterAuthEnvironment } from "../src/auth/runtime-auth.js";

export const authTestBaseURL = "https://api.example.test";
export const authTestTrustedOrigin = "https://app.example.test";
export const authTestGoogleClientId = "test-google-client-id";

const testSecret = "test-only-better-auth-secret-32-chars";

export function createAuthTestBindings(): BetterAuthEnvironment {
  return {
    ...env,
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: authTestBaseURL,
    BETTER_AUTH_TRUSTED_ORIGINS: ` ${authTestTrustedOrigin},${authTestTrustedOrigin} `,
    GOOGLE_CLIENT_ID: authTestGoogleClientId,
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  };
}

export async function createGoogleAuthTestSession(
  bindings: BetterAuthEnvironment,
  values: { email: string; name: string },
): Promise<{ cookie: string; playerId: string }> {
  const database = createRuntimeDatabase(bindings.DB);
  const playerId = crypto.randomUUID();
  const now = new Date();
  const token = crypto.randomUUID();

  await database.insert(user).values({
    id: playerId,
    name: values.name,
    email: values.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(account).values({
    id: crypto.randomUUID(),
    accountId: `google-${playerId}`,
    providerId: "google",
    userId: playerId,
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(session).values({
    id: crypto.randomUUID(),
    token,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    userId: playerId,
    ipAddress: "203.0.113.20",
    userAgent: "Vitest",
    createdAt: now,
    updatedAt: now,
  });

  const signature = await makeSignature(token, testSecret);
  return {
    cookie: `__Secure-better-auth.session_token=${token}.${signature}`,
    playerId,
  };
}
