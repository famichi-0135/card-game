import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ConnectionIndicator,
  FrameCorner,
  FrameLine,
  GameDivider,
  GameFrame,
  GlowAccent,
  IconMenuButton,
  PrimaryGameButton,
  SecondaryGameButton,
} from "./index.ts";

describe("ゲームHUD共通コンポーネント", () => {
  it("Primary・Secondary・Iconボタンを金属フレームと状態属性付きで描画する", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(PrimaryGameButton, null, "配置終了"),
        createElement(SecondaryGameButton, null, "すべて表示"),
        createElement(IconMenuButton, { "aria-label": "メニュー" }),
      ),
    );

    expect(markup).toContain('data-game-button="primary"');
    expect(markup).toContain('data-game-button="secondary"');
    expect(markup).toContain('data-game-button="icon-menu"');
    expect(markup).toContain('data-metal-layer="outer-shadow"');
    expect(markup).toContain('data-metal-layer="frame"');
    expect(markup).toContain('data-metal-layer="surface"');
    expect(markup).toContain('data-metal-layer="inner-contour"');
    expect(markup).toContain('data-metal-layer="edge-highlight"');
    expect(markup).toContain('data-metal-layer="surface-texture"');
    expect(markup).toContain('data-frame-palette="gold"');
    expect(markup).toContain('data-frame-palette="blue"');
    expect(markup).toContain('data-frame-lighting="interactive"');
    expect(markup).toContain('data-menu-dot="true"');
    expect(markup.match(/data-frame-path=/g)?.length ?? 0).toBeGreaterThan(8);
  });

  it("接続状態を色だけでなく文言と状態属性で表示する", () => {
    const connected = renderToStaticMarkup(
      createElement(ConnectionIndicator, { state: "connected" }),
    );
    const disconnected = renderToStaticMarkup(
      createElement(ConnectionIndicator, { state: "disconnected" }),
    );

    expect(connected).toContain('data-connection-indicator="connected"');
    expect(connected).toContain('data-metal-layer="frame"');
    expect(connected).toContain("接続済み");
    expect(disconnected).toContain('data-connection-indicator="disconnected"');
    expect(disconnected).toContain("未接続");
  });

  it("5色のコーナー・フレームラインと3種の区切り線をSVG装飾で描画する", () => {
    const variants = ["gray", "red", "blue", "gold", "green"] as const;
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        ...variants.flatMap((variant) => [
          createElement(FrameCorner, { key: `corner-${variant}`, variant }),
          createElement(FrameLine, { key: `line-${variant}`, variant }),
        ]),
        createElement(GameDivider, { variant: "solid" }),
        createElement(GameDivider, { variant: "dotted" }),
        createElement(GameDivider, { variant: "decorative" }),
      ),
    );

    for (const variant of variants) {
      expect(markup).toContain(`data-frame-corner="${variant}"`);
      expect(markup).toContain(`data-frame-line="${variant}"`);
    }
    expect(markup).toContain('data-game-divider="solid"');
    expect(markup).toContain('data-game-divider="dotted"');
    expect(markup).toContain('data-game-divider="decorative"');
    expect(markup).toContain('data-corner-ornament="rivet"');
    expect(markup).toContain('data-line-ornament="center-diamond"');
  });

  it("4色の多層Glowと装飾フレームを再利用できる", () => {
    const markup = renderToStaticMarkup(
      createElement(
        GameFrame,
        { variant: "gold" },
        createElement(GlowAccent, { variant: "red" }),
        createElement(GlowAccent, { variant: "blue" }),
        createElement(GlowAccent, { variant: "gold" }),
        createElement(GlowAccent, { variant: "green" }),
      ),
    );

    expect(markup).toContain('data-game-frame="gold"');
    expect(markup).toContain('data-frame-border-source="svg"');
    expect(markup).toContain('data-panel-border-geometry="linear-edges"');
    expect(markup).toContain('data-panel-material="textured-metal"');
    for (const variant of ["red", "blue", "gold", "green"] as const) {
      expect(markup).toContain(`data-glow-accent="${variant}"`);
    }
    expect(
      markup.match(/data-glow-layer=/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(16);
  });
});
