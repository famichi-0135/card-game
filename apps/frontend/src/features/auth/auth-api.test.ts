import { afterEach, describe, expect, it, vi } from "vitest";
import { signInAnonymously } from "./auth-api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("匿名ログイン", () => {
  it("Better Authの匿名ログインエンドポイントへCookie付きPOSTを送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock;

    await signInAnonymously();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/anonymous", {
      body: "{}",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });
});
