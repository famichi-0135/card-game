import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  AppHeader,
  getAppHeaderTransform,
  shouldHideAppHeader,
} from "./app-header.tsx";

describe("ゲーム外共通ヘッダー", () => {
  it("ホームと主要なゲーム外導線を共通のStickyヘッダーで提供する", () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/learn"] },
        createElement(AppHeader, {
          rightSlot: createElement("span", null, "account actions"),
        }),
      ),
    );

    expect(html).toContain('data-app-header="true"');
    expect(html).toContain('data-app-header-island="true"');
    expect(html).toContain('data-disastar-logo="true"');
    expect(html).toContain("sticky");
    expect(html).toContain("top-4");
    expect(html).toContain("sm:top-5");
    expect(html).toContain("max-w-[1596px]");
    expect(html).toContain("px-4");
    expect(html).toContain("sm:px-7");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/learn"');
    expect(html).toContain('href="/rule"');
  });

  it("十分に下へスクロールしたときだけヘッダーを隠す", () => {
    expect(shouldHideAppHeader({ currentY: 12, previousY: 0 })).toBe(false);
    expect(shouldHideAppHeader({ currentY: 80, previousY: 40 })).toBe(true);
    expect(shouldHideAppHeader({ currentY: 40, previousY: 80 })).toBe(false);
  });

  it("隠すときはアイランド本体と外側の余白まで画面外へ移動する", () => {
    expect(getAppHeaderTransform(true)).toBe("translateY(calc(-100% - 4rem))");
    expect(getAppHeaderTransform(false)).toBe("translateY(0)");
  });
});
