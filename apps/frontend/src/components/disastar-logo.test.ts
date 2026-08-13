import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DisastarLogo } from "./disastar-logo.tsx";

describe("DisastarLogo", () => {
  it("提供されたサイバー調SVGのブランド要素を描画する", () => {
    const html = renderToStaticMarkup(createElement(DisastarLogo));

    expect(html).toContain('data-disastar-logo="true"');
    expect(html).toContain('viewBox="0 0 580 140"');
    expect(html).toContain("DISASTAR");
    expect(html).toContain("EMERGENCY PROTOCOL");
    expect(html).toContain("linearGradient");
    expect(html).toContain("cyber-slit");
  });

  it("動きを減らす設定で装飾アニメーションを停止できる", () => {
    const html = renderToStaticMarkup(
      createElement(DisastarLogo, { animated: false }),
    );

    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toContain("animation: spin 40s linear infinite");
  });
});
