import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { LearnIndexRoute } from "./learn-routes.tsx";

describe("防災情報ページのUI・URL同期", () => {
  it("指定されたタグクエリパラメータに基づいて記事をフィルタリングする", () => {
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: ["/learn?tag=地震"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              Component: LearnIndexRoute,
              path: "/learn",
            }),
          ),
        ),
      ),
    );

    // タグ「地震」がアクティブ（選択状態）であることを検証
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("#地震");

    // タグ解除ボタンが表示されていることを検証
    expect(html).toContain("タグ選択を解除");
  });

  it("カテゴリ切り替えリンクにおいて、現在選択されているタグパラメータが引き継がれる", () => {
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: ["/learn?tag=地震"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              Component: LearnIndexRoute,
              path: "/learn",
            }),
          ),
        ),
      ),
    );

    // カテゴリリンクに現在選択中の「tag=地震」がURLエンコードされて引き継がれていることを検証
    // 「地震」のURLエンコードは「%E5%9C%B0%E9%9C%87」
    expect(html).toContain(
      'href="/learn?category=disaster-information&amp;tag=%E5%9C%B0%E9%9C%87"',
    );
    expect(html).toContain(
      'href="/learn?category=preparedness-action&amp;tag=%E5%9C%B0%E9%9C%87"',
    );
  });
});
