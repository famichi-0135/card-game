import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppPanel, AppShell, PageHeader } from "./application-ui.tsx";

describe("アプリケーションUI基盤", () => {
  it("トップページと同じ暗色サーフェス、技術ボーダー、見出し階層を提供する", () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          AppShell,
          {
            includeAccountMenu: false,
            headerRightSlot: null,
          },
          [
            createElement(PageHeader, {
              description: "画面の説明",
              eyebrow: "CONTEXT",
              title: "ページタイトル",
            }),
            createElement(AppPanel, { label: "DETAIL" }, "本文"),
          ],
        ),
      ),
    );

    expect(html).toContain('data-application-shell="true"');
    expect(html).toContain('data-application-panel="true"');
    expect(html).toContain("CONTEXT");
    expect(html).toContain("ページタイトル");
    expect(html).toContain("#03080c");
    expect(html).toContain("#2a3d4b");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("max-w-[1596px]");
    expect(html).toContain("sm:px-7");
  });

  it("アカウントメニューを明示的に省略した画面では、QueryProviderを必要としない", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(
            AppShell,
            { includeAccountMenu: false },
            createElement("p", null, "読込中"),
          ),
        ),
      ),
    ).not.toThrow();
  });
});
