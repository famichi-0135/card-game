import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { toast, ToastProvider, ToastViewport } from "./toast.tsx";
import { UI_LAYER } from "./ui-layers.ts";
import { ZoneDialog } from "../../features/game-board/components/zone-dialog.tsx";
import { createGameBoardFixture } from "../../features/game-board/fixtures/game-board-fixture.ts";
import { FixtureGameBoard } from "../../features/game-board/game-board.tsx";

describe("ゲーム画面のUIレイヤー", () => {
  it("盤面、ポップオーバー、モーダル、トーストの順序を明示する", () => {
    expect(UI_LAYER.board).toBeLessThan(UI_LAYER.popover);
    expect(UI_LAYER.popover).toBeLessThan(UI_LAYER.modal);
    expect(UI_LAYER.modal).toBeLessThan(UI_LAYER.toast);
  });

  it("盤面を積層コンテキストに閉じ込め、モーダルを盤面より上に置く", () => {
    const fixture = createGameBoardFixture("layer-order");
    const boardMarkup = renderToStaticMarkup(
      createElement(FixtureGameBoard, { fixture }),
    );
    const dialogMarkup = renderToStaticMarkup(
      createElement(ZoneDialog, {
        catalog: fixture.catalog,
        onClose: vi.fn(),
        state: {
          cards: fixture.view.opponent.discardPile,
          description: "公開済みカード",
          title: "相手の捨て札",
        },
      }),
    );

    expect(boardMarkup).toContain('data-ui-layer="board"');
    expect(boardMarkup).toContain("relative isolate");
    expect(boardMarkup).toContain("z-0");
    expect(dialogMarkup).toContain('data-ui-layer="modal"');
    expect(dialogMarkup).toContain("z-[900]");
  });

  it("トースト表示領域をモーダルより上に置く", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ToastProvider,
        { toastManager: toast },
        createElement(ToastViewport),
      ),
    );

    expect(markup).toContain('data-ui-layer="toast"');
    expect(markup).toContain("z-[1000]");
  });
});
