import type { PlayerId } from "@disastar/game-engine/contracts";
import { createAuthEmailService } from "./auth-email-service.js";
import { createAuth, type BackgroundTaskScheduler } from "./create-auth.js";
import { createCloudflareEmailSender } from "../email/cloudflare-email-sender.js";
import type { BetterAuthEnvironment } from "./request-authenticator.js";

export type { BetterAuthEnvironment } from "./request-authenticator.js";

export function createRuntimeAuth(
  environment: BetterAuthEnvironment,
  scheduleBackgroundTask?: BackgroundTaskScheduler,
) {
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
    emailService: createAuthEmailService(
      createCloudflareEmailSender({
        binding: requireEmailBinding(environment.EMAIL),
        from: {
          email: requireBinding(environment.AUTH_EMAIL_FROM, "AUTH_EMAIL_FROM"),
          name:
            optionalBinding(environment.AUTH_EMAIL_FROM_NAME) ??
            "Disastar Card Game",
        },
      }),
    ),
    scheduleBackgroundTask,
  });
}

export function handleBetterAuthRequest(
  request: Request,
  environment: BetterAuthEnvironment,
  scheduleBackgroundTask?: BackgroundTaskScheduler,
): Promise<Response> {
  return createRuntimeAuth(environment, scheduleBackgroundTask).handler(
    request,
  );
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

export function parseTrustedOrigins(value: string): string[] {
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

function optionalBinding(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const configured = value.trim();
  return configured.length === 0 ? undefined : configured;
}

function requireEmailBinding(binding: SendEmail | undefined): SendEmail {
  if (binding === undefined || typeof binding.send !== "function") {
    throw new Error("EMAIL binding must provide send()");
  }
  return binding;
}
