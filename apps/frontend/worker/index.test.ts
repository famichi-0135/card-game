import { describe, expect, it, vi } from "vitest";
import worker from "./index.ts";

describe("Frontend Worker の認証プロキシ", () => {
  it("ゲスト引継ぎの競合をログイン画面へ戻し、新しい認証Cookieを転送しない", async () => {
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "ACCOUNT_LINK_CONFLICT" }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "better-auth.session_token=new-session",
        },
        status: 409,
      }),
    );
    const assetFetch = vi.fn();

    const response = await worker.fetch(
      new Request(
        "https://app.example.test/api/auth/callback/google?state=state&code=code",
      ),
      {
        ASSETS: { fetch: assetFetch },
        BACKEND: { fetch: backendFetch },
      } as unknown as Env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/login?oauthError=1&error=ACCOUNT_LINK_CONFLICT",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it("Better Authが競合エラーへリダイレクトした場合も、新しい認証Cookieを転送しない", async () => {
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: {
          location:
            "https://app.example.test/login?oauthError=1&error=ACCOUNT_LINK_CONFLICT",
          "set-cookie": "better-auth.session_token=new-session",
        },
        status: 302,
      }),
    );

    const response = await worker.fetch(
      new Request(
        "https://app.example.test/api/auth/callback/google?state=state&code=code",
      ),
      {
        ASSETS: { fetch: vi.fn() },
        BACKEND: { fetch: backendFetch },
      } as unknown as Env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/login?oauthError=1&error=ACCOUNT_LINK_CONFLICT",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
