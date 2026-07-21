import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index.js";
import { createRuntimeAuth } from "../src/auth/runtime-auth.js";
import {
  authTestBaseURL as baseURL,
  authTestTrustedOrigin as trustedOrigin,
  createAuthTestBindings,
} from "./auth-test-bindings.js";

describe("Better Auth HTTP統合", () => {
  it("Honoの認証ルートで登録し、セッションから既存APIを認証する", async () => {
    const app = createApp();
    const sentEmails: EmailMessageBuilder[] = [];
    const bindings = createAuthTestBindings(sentEmails);
    const registrationContext = createExecutionContext();
    const registration = await app.request(
      new Request(`${baseURL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.20",
          "content-type": "application/json",
          origin: trustedOrigin,
        },
        body: JSON.stringify({
          name: "HTTP Auth User",
          email: "http-auth@example.com",
          password: "a-secure-test-password",
        }),
      }),
      undefined,
      bindings,
      registrationContext,
    );
    await waitOnExecutionContext(registrationContext);

    expect(registration.status).toBe(200);
    expect(registration.headers.get("set-cookie")).toBeNull();
    expect(sentEmails).toHaveLength(1);

    const verificationURL = extractActionURL(sentEmails[0]?.text);
    const verificationContext = createExecutionContext();
    const verification = await app.request(
      new Request(verificationURL, {
        headers: { "cf-connecting-ip": "203.0.113.20" },
      }),
      undefined,
      bindings,
      verificationContext,
    );
    await waitOnExecutionContext(verificationContext);
    expect(verification.status).toBe(302);

    const signInContext = createExecutionContext();
    const signIn = await app.request(
      new Request(`${baseURL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.20",
          "content-type": "application/json",
          origin: trustedOrigin,
        },
        body: JSON.stringify({
          email: "http-auth@example.com",
          password: "a-secure-test-password",
        }),
      }),
      undefined,
      bindings,
      signInContext,
    );
    await waitOnExecutionContext(signInContext);
    expect(signIn.status).toBe(200);
    const cookie = getSessionCookie(signIn);

    const sessionContext = createExecutionContext();
    const session = await app.request(
      new Request(`${baseURL}/api/auth/get-session`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
      sessionContext,
    );
    await waitOnExecutionContext(sessionContext);
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({
      user: {
        email: "http-auth@example.com",
        name: "HTTP Auth User",
      },
    });

    const decks = await app.request(
      new Request(`${baseURL}/api/decks`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(decks.status).toBe(200);
    await expect(decks.json()).resolves.toEqual({ decks: [] });

    const missingGame = await app.request(
      new Request(`${baseURL}/api/games/missing-game`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(missingGame.status).toBe(404);
    await expect(missingGame.json()).resolves.toEqual({
      error: { code: "GAME_NOT_FOUND" },
    });

    const missingMatch = await app.request(
      new Request(`${baseURL}/api/matches/not-a-durable-object-id`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(missingMatch.status).toBe(404);
    await expect(missingMatch.json()).resolves.toEqual({
      error: { code: "MATCH_NOT_FOUND" },
    });
  });

  it.each([
    "/api/decks",
    "/api/games/missing-game",
    "/api/matches/not-a-durable-object-id",
  ])("セッションCookieがない%sリクエストを拒否する", async (path) => {
    const response = await createApp().request(
      new Request(`${baseURL}${path}`),
      undefined,
      createAuthTestBindings(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("認証用環境変数が欠けている場合は設定エラーにする", () => {
    const bindings = createAuthTestBindings();
    const invalidBindings = {
      ...bindings,
      BETTER_AUTH_TRUSTED_ORIGINS: "  ",
    };

    expect(() => createRuntimeAuth(invalidBindings)).toThrowError(
      "BETTER_AUTH_TRUSTED_ORIGINS must not be empty",
    );
  });

  it("送信元メールアドレスが欠けている場合は設定エラーにする", () => {
    const bindings = createAuthTestBindings();
    const invalidBindings = {
      ...bindings,
      AUTH_EMAIL_FROM: "  ",
    };

    expect(() => createRuntimeAuth(invalidBindings)).toThrowError(
      "AUTH_EMAIL_FROM must not be empty",
    );
  });

  it("Email Service Bindingが欠けている場合は設定エラーにする", () => {
    const bindings = createAuthTestBindings();
    const invalidBindings = {
      ...bindings,
      EMAIL: undefined,
    } as unknown as Parameters<typeof createRuntimeAuth>[0];

    expect(() => createRuntimeAuth(invalidBindings)).toThrowError(
      "EMAIL binding must provide send()",
    );
  });
});

function getSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("認証レスポンスにセッションCookieがありません。");
  }
  return setCookie.split(";", 1)[0] ?? "";
}

function authenticatedHeaders(cookie: string): HeadersInit {
  return {
    "cf-connecting-ip": "203.0.113.20",
    cookie,
  };
}

function extractActionURL(text: string | undefined): string {
  const actionURL = text?.match(/https:\/\/[^\s]+/)?.[0];
  if (actionURL === undefined) {
    throw new Error("認証メールに操作URLがありません。");
  }
  return actionURL;
}
