import type { PlayerId } from "@disastar/game-engine/contracts";
import { createAuth } from "./create-auth.js";
import type { BetterAuthEnvironment } from "./request-authenticator.js";

export type { BetterAuthEnvironment } from "./request-authenticator.js";

export function createRuntimeAuth(environment: BetterAuthEnvironment) {
  return createAuth({
    database: environment.DB,
    baseURL: requireBinding(environment.BETTER_AUTH_URL, "BETTER_AUTH_URL"),
    secret: requireBinding(
      environment.BETTER_AUTH_SECRET,
      "BETTER_AUTH_SECRET",
    ),
    trustedOrigins: parseTrustedOrigins(
      environment.BETTER_AUTH_TRUSTED_ORIGINS,
    ),
  });
}

export function handleBetterAuthRequest(
  request: Request,
  environment: BetterAuthEnvironment,
): Promise<Response> {
  return createRuntimeAuth(environment).handler(request);
}

export async function authenticateBetterAuthRequest(
  request: Request,
  environment: BetterAuthEnvironment,
): Promise<PlayerId | null> {
  const result = await createRuntimeAuth(environment).api.getSession({
    headers: request.headers,
  });
  return result?.user.id ?? null;
}

function parseTrustedOrigins(value: string): string[] {
  const configured = requireBinding(value, "BETTER_AUTH_TRUSTED_ORIGINS");
  const origins = [
    ...new Set(
      configured
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  ];

  if (origins.length === 0) {
    throw new Error(
      "BETTER_AUTH_TRUSTED_ORIGINS must contain at least one origin",
    );
  }
  return origins;
}

function requireBinding(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  return value.trim();
}
