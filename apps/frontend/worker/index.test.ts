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

describe("Frontend Worker のゲーム画像配信", () => {
  it("R2画像を同一オリジンで配信し、長期キャッシュとETagを付ける", async () => {
    const gameAssetsGet = vi.fn().mockResolvedValue({
      body: new Blob(["image-body"]).stream(),
      httpEtag: '"asset-etag"',
      writeHttpMetadata(headers: Headers) {
        headers.set("content-type", "image/png");
      },
    });
    const assetFetch = vi.fn();
    const backendFetch = vi.fn();

    const response = await worker.fetch(
      new Request(
        "https://app.example.test/game-assets/backgrounds/board/night-city-aerial.png",
      ),
      {
        ASSETS: { fetch: assetFetch },
        BACKEND: { fetch: backendFetch },
        GAME_ASSETS: { get: gameAssetsGet },
      } as unknown as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("etag")).toBe('"asset-etag"');
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(gameAssetsGet).toHaveBeenCalledWith(
      "backgrounds/board/night-city-aerial.png",
      expect.objectContaining({ onlyIf: expect.any(Headers) }),
    );
    expect(assetFetch).not.toHaveBeenCalled();
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("危険なキーと書き込み要求を安全に拒否する", async () => {
    const gameAssetsGet = vi.fn();
    const env = {
      ASSETS: { fetch: vi.fn() },
      BACKEND: { fetch: vi.fn() },
      GAME_ASSETS: { get: gameAssetsGet },
    } as unknown as Env;

    const invalid = await worker.fetch(
      new Request(
        "https://app.example.test/game-assets/backgrounds/%252e%252e/private.png",
      ),
      env,
    );
    const write = await worker.fetch(
      new Request("https://app.example.test/game-assets/backgrounds/new.png", {
        method: "PUT",
      }),
      env,
    );

    expect(invalid.status).toBe(400);
    expect(write.status).toBe(405);
    expect(gameAssetsGet).not.toHaveBeenCalled();
  });
});
