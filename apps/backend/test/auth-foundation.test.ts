import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createAuth } from "../src/auth/create-auth.js";
import { createRuntimeDatabase } from "../src/db/runtime.js";
import { user } from "../src/db/schema/auth.js";

const testSecret = "test-only-better-auth-secret-32-chars";

describe("D1・Drizzle・Better Auth 基盤", () => {
  it("Drizzleマイグレーションで認証テーブルを作成する", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all<{ name: string }>();

    expect(result.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "account",
        "rate_limit",
        "session",
        "user",
        "verification",
      ]),
    );
  });

  it("WorkersのD1 Bindingから作成したDrizzleで読み書きできる", async () => {
    const database = createRuntimeDatabase(env.DB);
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    await database.insert(user).values({
      id: "database-user",
      name: "Database User",
      email: "database@example.com",
      emailVerified: false,
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      database.select().from(user).where(eq(user.id, "database-user")),
    ).resolves.toEqual([
      {
        id: "database-user",
        name: "Database User",
        email: "database@example.com",
        emailVerified: false,
        image: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
  });

  it("Better AuthにGoogle OAuthプロバイダーを設定する", async () => {
    const auth = createAuth({
      database: env.DB,
      baseURL: "https://api.example.test",
      googleClientId: "test-google-client-id",
      googleClientSecret: "test-google-client-secret",
      secret: testSecret,
      trustedOrigins: ["https://app.example.test"],
    });

    const response = await auth.handler(
      new Request("https://api.example.test/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "content-type": "application/json",
          origin: "https://app.example.test",
        },
        body: JSON.stringify({
          provider: "google",
          disableRedirect: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { url: string };
    expect(new URL(result.url).searchParams.get("client_id")).toBe(
      "test-google-client-id",
    );
  });

  it("短すぎる認証秘密鍵を拒否する", () => {
    expect(() =>
      createAuth({
        database: env.DB,
        baseURL: "https://api.example.test",
        googleClientId: "test-google-client-id",
        googleClientSecret: "test-google-client-secret",
        secret: "too-short",
        trustedOrigins: ["https://app.example.test"],
      }),
    ).toThrowError("BETTER_AUTH_SECRET must be at least 32 characters");
  });
});
