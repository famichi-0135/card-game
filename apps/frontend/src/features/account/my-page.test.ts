import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthenticatedSessionResponse } from "@disastar/contracts/session";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { MyPage } from "./my-page.tsx";

describe("マイページのアカウント操作", () => {
  it("Googleアカウントには明示的なログアウトボタンを表示する", () => {
    const markup = renderMyPage({
      isAnonymous: false,
      playerId: "player-1",
      user: { id: "user-1", image: null, name: "Google利用者" },
    });

    expect(markup).toContain("ログアウト");
  });
});

function renderMyPage(session: AuthenticatedSessionResponse): string {
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, createElement(MyPage, { session })),
    ),
  );
}
