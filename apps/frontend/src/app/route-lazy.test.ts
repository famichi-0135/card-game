import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  createLazyRoute,
  resolveNamedRoute,
  RouteLoadingFallback,
} from "./route-lazy.tsx";

describe("route lazy loading", () => {
  it("名前付きexportをReact.lazy用のdefault exportへ変換する", async () => {
    function ExampleRoute() {
      return null;
    }

    await expect(
      resolveNamedRoute(async () => ({ ExampleRoute }), "ExampleRoute"),
    ).resolves.toEqual({ default: ExampleRoute });
  });

  it("指定した画面exportがなければ明示的に失敗する", async () => {
    await expect(
      resolveNamedRoute(async () => ({}), "MissingRoute"),
    ).rejects.toThrow("Route module does not export MissingRoute.");
  });

  it("画面モジュールはルートコンポーネントの作成時に読み込まない", () => {
    const loader = vi.fn(() => new Promise<Record<string, unknown>>(() => {}));
    const LazyRoute = createLazyRoute(loader, "ExampleRoute");

    expect(LazyRoute).toBeTypeOf("function");
    expect(loader).not.toHaveBeenCalled();
  });

  it("待機表示を通知し、トップへ戻れる", () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(RouteLoadingFallback)),
    );

    expect(html).toContain("ページを読み込んでいます");
    expect(html).toContain('role="status"');
    expect(html).toContain('href="/"');
  });
});
