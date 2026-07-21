import type { PlayerId } from "@disastar/game-engine/contracts";

export type BetterAuthEnvironment = CloudflareBindings & {
  EMAIL: SendEmail;
  AUTH_EMAIL_FROM: string;
  AUTH_EMAIL_FROM_NAME?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
};

export type RequestAuthenticator = (
  request: Request,
  environment: BetterAuthEnvironment,
) => Promise<PlayerId | null>;
