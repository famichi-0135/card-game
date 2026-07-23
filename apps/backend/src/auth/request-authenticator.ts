import type { PlayerId } from "@disastar/game-engine/contracts";

export type BetterAuthEnvironment = CloudflareBindings & {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type RequestAuthenticator = (
  request: Request,
  environment: BetterAuthEnvironment,
) => Promise<PlayerId | null>;
