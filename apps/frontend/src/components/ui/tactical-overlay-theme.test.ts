import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createGameBoardFixture } from "../../features/game-board/fixtures/game-board-fixture.ts";
import { GameResultDialog } from "../../features/game-board/components/game-result-dialog.tsx";
import { PhaseEndDialog } from "../../features/game-board/components/phase-end-dialog.tsx";
import { SupportTargetDialog } from "../../features/game-board/components/support-target-dialog.tsx";
import { ZoneDialog } from "../../features/game-board/components/zone-dialog.tsx";
import {
  TACTICAL_MODAL_SURFACE_CLASS,
  TACTICAL_TOAST_SURFACE_CLASS,
} from "./tactical-overlay-theme.ts";

describe("モーダルとトーストのtactical dark theme", () => {
  it("共通モーダルsurfaceを黒基調で定義する", () => {
    expect(TACTICAL_MODAL_SURFACE_CLASS).toContain("bg-[#04090d]");
    expect(TACTICAL_MODAL_SURFACE_CLASS).toContain("border-[#8b7448]/80");
    expect(TACTICAL_MODAL_SURFACE_CLASS).not.toContain("bg-white");
  });

  it("ゲーム固有モーダルはdark themeをDOM上で明示する", () => {
    const fixture = createGameBoardFixture("dark-modal-theme", "finished");
    const dialogs = [
      createElement(ZoneDialog, {
        catalog: fixture.catalog,
        onClose: vi.fn(),
        state: { cards: [], description: "説明", title: "ゾーン" },
      }),
      createElement(PhaseEndDialog, {
        actionLabel: "配置終了",
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
      createElement(SupportTargetDialog, {
        cardName: "防災訓練",
        effectSelections: [],
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
        view: fixture.view,
      }),
      createElement(
        MemoryRouter,
        null,
        createElement(GameResultDialog, { view: fixture.view }),
      ),
    ];

    for (const dialog of dialogs) {
      const markup = renderToStaticMarkup(dialog);
      expect(markup).toContain('data-modal-theme="tactical-dark"');
      expect(markup).toContain("bg-[#04090d]");
      expect(markup).not.toContain("bg-white");
    }
  });

  it("共通トーストsurfaceを黒基調で定義する", () => {
    expect(TACTICAL_TOAST_SURFACE_CLASS).toContain("bg-[#050a0e]");
    expect(TACTICAL_TOAST_SURFACE_CLASS).not.toContain("bg-popover");
  });
});
