import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DragDropProvider } from "@dnd-kit/react";
import { describe, expect, it, vi } from "vitest";
import { GameBoardView } from "./game-board-view.tsx";
import { createGameBoardFixture } from "./fixtures/game-board-fixture.ts";

describe("ゲーム盤面のキーボード操作", () => {
  it("手札を選択し、固定枠・捨て札・サポートゾーンをキーボードで操作できる", () => {
    const fixture = createGameBoardFixture("keyboard-actions");
    const markup = renderToStaticMarkup(
      createElement(
        DragDropProvider,
        { onDragEnd: vi.fn() },
        createElement(GameBoardView, {
          availableActions: fixture.availableActions,
          catalog: fixture.catalog,
          commandError: "そのカードは手札にありません。",
          commandPending: false,
          connectionState: "connected",
          isInteractive: true,
          onCancelSelectedCard: vi.fn(),
          onCancelSupportPlay: vi.fn(),
          onConfirmSupportPlay: vi.fn(),
          onFinishPhase: vi.fn(),
          onSelectCard: vi.fn(),
          onSelectCardTarget: vi.fn(() => true),
          onResynchronize: vi.fn(),
          opponentOnline: true,
          pendingSupportPlay: null,
          publicEvents: [],
          selectedCardInstanceId: "hand-flood",
          view: fixture.view,
        }),
      ),
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("選択中のカード: 直下型地震");
    expect(markup).toContain(
      'aria-label="攻撃グループ枠 1。選択中のカードをここへ操作"',
    );
    expect(markup).toContain('aria-label="捨て札。選択中のカードをここへ破棄"');
    expect(markup).toContain(
      'aria-label="サポート。選択中のカードをここで使用"',
    );
    expect(markup).toContain("focus-visible:outline-2");
    expect(markup).toContain("motion-reduce:transition-none");
    expect(markup).toContain("そのカードは手札にありません。");
    expect(markup).toContain("盤面を再同期");
  });
});
