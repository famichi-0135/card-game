import { env } from "cloudflare:test";
import type { BetterAuthEnvironment } from "../src/auth/runtime-auth.js";

export const authTestBaseURL = "https://api.example.test";
export const authTestTrustedOrigin = "https://app.example.test";
export const authTestEmailFrom = "noreply@example.test";

const testSecret = "test-only-better-auth-secret-32-chars";

export function createAuthTestBindings(
  sentEmails: EmailMessageBuilder[] = [],
): BetterAuthEnvironment {
  return {
    ...env,
    EMAIL: {
      async send(message: EmailMessage | EmailMessageBuilder) {
        if ("subject" in message) {
          sentEmails.push(message);
        }
        return { messageId: `test-email-${sentEmails.length}` };
      },
    } as unknown as SendEmail,
    AUTH_EMAIL_FROM: authTestEmailFrom,
    AUTH_EMAIL_FROM_NAME: "Disastar Card Game Test",
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: authTestBaseURL,
    BETTER_AUTH_TRUSTED_ORIGINS: ` ${authTestTrustedOrigin},${authTestTrustedOrigin} `,
  };
}
