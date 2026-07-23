import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuth } from "../src/auth/create-auth.js";
import {
  authTestBaseURL as baseURL,
  authTestGoogleClientId,
  authTestTrustedOrigin as trustedOrigin,
} from "./auth-test-bindings.js";

const testSecret = "test-only-better-auth-secret-32-chars";

describe("Better Auth Google OAuth", () => {
  it("openid、email、profileだけを要求してGoogleの認可画面へ遷移する", async () => {
    const auth = createAuth({
      database: env.DB,
      baseURL,
      googleClientId: authTestGoogleClientId,
      googleClientSecret: "test-google-client-secret",
      secret: testSecret,
      trustedOrigins: [trustedOrigin],
    });

    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.30",
          "content-type": "application/json",
          origin: trustedOrigin,
        },
        body: JSON.stringify({
          callbackURL: `${trustedOrigin}/games/game-1`,
          disableRedirect: true,
          provider: "google",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { url: string };
    const authorizationURL = new URL(result.url);

    expect(authorizationURL.origin).toBe("https://accounts.google.com");
    expect(authorizationURL.searchParams.get("client_id")).toBe(
      authTestGoogleClientId,
    );
    expect(authorizationURL.searchParams.get("redirect_uri")).toBe(
      `${baseURL}/api/auth/callback/google`,
    );
    expect(authorizationURL.searchParams.get("scope")).toContain("openid");
    expect(authorizationURL.searchParams.get("scope")).toContain("email");
    expect(authorizationURL.searchParams.get("scope")).toContain("profile");
  });

  it("メール・パスワード登録を無効化する", async () => {
    const auth = createAuth({
      database: env.DB,
      baseURL,
      googleClientId: authTestGoogleClientId,
      googleClientSecret: "test-google-client-secret",
      secret: testSecret,
      trustedOrigins: [trustedOrigin],
    });

    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.30",
          "content-type": "application/json",
          origin: trustedOrigin,
        },
        body: JSON.stringify({
          email: "player@example.com",
          name: "Player",
          password: "a-secure-test-password",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    });
  });
});
