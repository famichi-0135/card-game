import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index.js";
import { createRuntimeAuth } from "../src/auth/runtime-auth.js";
import { createRuntimeDatabase } from "../src/db/runtime.js";
import { user } from "../src/db/schema/auth.js";
import {
  authTestBaseURL as baseURL,
  authTestTrustedOrigin as trustedOrigin,
  createGoogleAuthTestSession,
  createAuthTestBindings,
} from "./auth-test-bindings.js";

describe("Better Auth HTTP統合", () => {
  it("許可済みOriginの認証プリフライトへCredential付きCORSを返す", async () => {
    const response = await createApp().request(
      new Request(`${baseURL}/api/auth/sign-in/social`, {
        method: "OPTIONS",
        headers: {
          origin: trustedOrigin,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      }),
      undefined,
      createAuthTestBindings(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      trustedOrigin,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("未許可Originの認証プリフライトへOrigin許可を返さない", async () => {
    const response = await createApp().request(
      new Request(`${baseURL}/api/auth/sign-in/social`, {
        method: "OPTIONS",
        headers: {
          origin: "https://untrusted.example.test",
          "access-control-request-method": "POST",
        },
      }),
      undefined,
      createAuthTestBindings(),
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("Google OAuthセッションから既存APIを認証する", async () => {
    const app = createApp();
    const bindings = createAuthTestBindings();
    const { cookie, playerId } = await createGoogleAuthTestSession(bindings, {
      email: "http-auth@example.com",
      image: "https://example.test/avatar.png",
      name: "HTTP Auth User",
    });

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

    const playerSession = await app.request(
      new Request(`${baseURL}/api/session`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(playerSession.status).toBe(200);
    await expect(playerSession.json()).resolves.toEqual({
      isAnonymous: false,
      playerId,
      user: {
        id: playerId,
        image: "https://example.test/avatar.png",
        name: "HTTP Auth User",
      },
    });

    const repeatedPlayerSession = await app.request(
      new Request(`${baseURL}/api/session`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(repeatedPlayerSession.status).toBe(200);
    await expect(repeatedPlayerSession.json()).resolves.toMatchObject({
      isAnonymous: false,
      playerId,
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

  it("匿名セッションを作成し、固定PlayerIdを返す", async () => {
    const app = createApp();
    const bindings = createAuthTestBindings();

    const signInResponse = await app.request(
      new Request(`${baseURL}/api/auth/sign-in/anonymous`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.21",
          "content-type": "application/json",
          origin: trustedOrigin,
        },
      }),
      undefined,
      bindings,
    );
    expect(signInResponse.status).toBe(200);
    const signInPayload = (await signInResponse.json()) as {
      user: { id: string; name: string; isAnonymous: boolean };
    };
    expect(signInPayload.user.isAnonymous).toBe(true);
    expect(signInPayload.user.name).toMatch(/^ゲスト-[a-f0-9]{8}$/);

    const cookie = getSessionCookie(signInResponse);
    const playerSession = await app.request(
      new Request(`${baseURL}/api/session`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(playerSession.status).toBe(200);
    await expect(playerSession.json()).resolves.toEqual({
      isAnonymous: true,
      playerId: signInPayload.user.id,
      user: {
        id: signInPayload.user.id,
        image: null,
        name: signInPayload.user.name,
      },
    });

    const database = createRuntimeDatabase(bindings.DB);
    await expect(
      database.select().from(user).where(eq(user.id, signInPayload.user.id)),
    ).resolves.toEqual([
      expect.objectContaining({
        emailVerified: false,
        isAnonymous: true,
        name: signInPayload.user.name,
      }),
    ]);
  });

  it("アカウント削除で認証ユーザーとセッションを無効化する", async () => {
    const app = createApp();
    const bindings = createAuthTestBindings();

    const signInResponse = await app.request(
      new Request(`${baseURL}/api/auth/sign-in/anonymous`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.22",
          "content-type": "application/json",
          origin: trustedOrigin,
        },
      }),
      undefined,
      bindings,
    );
    expect(signInResponse.status).toBe(200);
    const signInPayload = (await signInResponse.json()) as {
      user: { id: string };
    };
    const cookie = getSessionCookie(signInResponse);

    const deleteResponse = await app.request(
      new Request(`${baseURL}/api/auth/delete-user`, {
        method: "POST",
        headers: {
          ...authenticatedHeaders(cookie),
          "content-type": "application/json",
          origin: trustedOrigin,
        },
        body: JSON.stringify({}),
      }),
      undefined,
      bindings,
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      success: true,
      message: "User deleted",
    });

    const deletedSession = await app.request(
      new Request(`${baseURL}/api/session`, {
        headers: authenticatedHeaders(cookie),
      }),
      undefined,
      bindings,
    );
    expect(deletedSession.status).toBe(401);

    const database = createRuntimeDatabase(bindings.DB);
    await expect(
      database.select().from(user).where(eq(user.id, signInPayload.user.id)),
    ).resolves.toEqual([]);
  });

  it.each([
    "/api/decks",
    "/api/games/missing-game",
    "/api/matches/not-a-durable-object-id",
    "/api/session",
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

  it("Google OAuthクライアントIDが欠けている場合は設定エラーにする", () => {
    const bindings = createAuthTestBindings();
    const invalidBindings = {
      ...bindings,
      GOOGLE_CLIENT_ID: "  ",
    };

    expect(() => createRuntimeAuth(invalidBindings)).toThrowError(
      "GOOGLE_CLIENT_ID must not be empty",
    );
  });

  it("Google OAuthクライアントSecretが欠けている場合は設定エラーにする", () => {
    const bindings = createAuthTestBindings();
    const invalidBindings = {
      ...bindings,
      GOOGLE_CLIENT_SECRET: "  ",
    };

    expect(() => createRuntimeAuth(invalidBindings)).toThrowError(
      "GOOGLE_CLIENT_SECRET must not be empty",
    );
  });
});

function authenticatedHeaders(cookie: string): HeadersInit {
  return {
    "cf-connecting-ip": "203.0.113.20",
    cookie,
  };
}

function getSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("匿名ログインのセッションCookieが返されませんでした。");
  }

  return setCookie.split(";", 1)[0];
}
