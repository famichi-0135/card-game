import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { RuntimeDatabase } from "../db/runtime.js";
import { createRuntimeDatabase } from "../db/runtime.js";
import * as schema from "../db/schema/index.js";
import type {
  AuthEmailMessage,
  AuthEmailService,
} from "./auth-email-service.js";

const minimumSecretLength = 32;

export type CreateAuthInput = {
  database: D1Database;
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  emailService?: AuthEmailService;
  scheduleBackgroundTask?: BackgroundTaskScheduler;
};

export type BackgroundTaskScheduler = (task: Promise<unknown>) => void;

type CreateAuthWithDatabaseInput = Omit<CreateAuthInput, "database"> & {
  database: RuntimeDatabase;
};

export function createAuth({ database, ...options }: CreateAuthInput) {
  return createAuthWithDatabase({
    database: createRuntimeDatabase(database),
    ...options,
  });
}

export function createAuthWithDatabase({
  database,
  baseURL,
  secret,
  trustedOrigins,
  emailService,
  scheduleBackgroundTask,
}: CreateAuthWithDatabaseInput) {
  assertAuthConfiguration({ baseURL, secret, trustedOrigins });

  return betterAuth({
    appName: "Disastar Card Game",
    baseURL,
    secret,
    trustedOrigins,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: emailService !== undefined,
      resetPasswordTokenExpiresIn: 60 * 30,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword:
        emailService === undefined
          ? undefined
          : ({ user, url }) =>
              dispatchAuthEmail(
                emailService,
                {
                  type: "password-reset",
                  to: user.email,
                  userName: user.name,
                  actionURL: url,
                },
                scheduleBackgroundTask,
              ),
    },
    emailVerification:
      emailService === undefined
        ? undefined
        : {
            expiresIn: 60 * 60,
            sendOnSignUp: true,
            sendOnSignIn: true,
            autoSignInAfterVerification: false,
            sendVerificationEmail: ({ user, url }) =>
              dispatchAuthEmail(
                emailService,
                {
                  type: "email-verification",
                  to: user.email,
                  userName: user.name,
                  actionURL: url,
                },
                scheduleBackgroundTask,
              ),
          },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: new URL(baseURL).protocol === "https:",
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      backgroundTasks:
        scheduleBackgroundTask === undefined
          ? undefined
          : { handler: scheduleBackgroundTask },
    },
  });
}

function dispatchAuthEmail(
  emailService: AuthEmailService,
  message: AuthEmailMessage,
  scheduleBackgroundTask?: BackgroundTaskScheduler,
): Promise<void> {
  const task = emailService.send(message);
  if (scheduleBackgroundTask === undefined) {
    return task;
  }

  scheduleBackgroundTask(task);
  return Promise.resolve();
}

function assertAuthConfiguration({
  baseURL,
  secret,
  trustedOrigins,
}: Omit<CreateAuthInput, "database">) {
  if (secret.length < minimumSecretLength) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  }

  const base = new URL(baseURL);

  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL must use http or https");
  }

  if (trustedOrigins.length === 0) {
    throw new Error("BETTER_AUTH_TRUSTED_ORIGINS must not be empty");
  }
}
