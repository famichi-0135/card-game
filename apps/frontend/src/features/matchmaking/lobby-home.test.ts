import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { LobbyLayout, RoleActions } from "./lobby-home.tsx";

describe("対戦準備トップの表示", () => {
  it("既存の導線を保ちながら、戦術UIのHero構造で表示する", () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(
          LobbyLayout,
          {
            accountSlot: createElement("span", null, "アカウント"),
            title: "対戦準備",
          },
          createElement(RoleActions, { disabled: false, onSelect: vi.fn() }),
        ),
      ),
    );

    expect(html).toContain('data-home-surface="tactical"');
    expect(html).toContain('data-home-hero="true"');
    expect(html).toContain('data-home-hero-backdrop="r2"');
    expect(html).toContain(
      "/game-assets/backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png",
    );
    expect(html).toContain("max-w-[1596px]");
    expect(html).toContain('href="/rule"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain("招待のみ");
    expect(html).toContain("一覧に公開");
  });
});
