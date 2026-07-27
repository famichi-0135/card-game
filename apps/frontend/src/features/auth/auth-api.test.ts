import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteAccount, signInAnonymously } from "./auth-api.ts";

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

describe("アカウント削除", () => {
  it("Better Authの削除エンドポイントへCookie付きPOSTを送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"success":true,"message":"User deleted"}', {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    globalThis.fetch = fetchMock;

    await deleteAccount();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/delete-user", {
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
