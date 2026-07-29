import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGameBoardFixture } from "../fixtures/game-board-fixture.ts";
import { AttackGroupSlot } from "./attack-group-slot.tsx";

const useDroppable = vi.hoisted(() =>
  vi.fn(() => ({
    isDropTarget: false,
    ref: vi.fn(),
  })),
);

vi.mock("@dnd-kit/react", () => ({ useDroppable }));

describe("攻撃グループ枠", () => {
  beforeEach(() => {
    useDroppable.mockClear();
  });

  it("相手側の枠をドロップ対象として登録しない", () => {
    renderToStaticMarkup(
      createElement(AttackGroupSlot, {
        canChain: false,
        canPlace: false,
        catalog: createGameBoardFixture("opponent-slot").catalog,
        group: undefined,
        isSelf: false,
        slotIndex: 0,
      }),
    );

    expect(useDroppable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
    );
  });

  it("自分側の枠だけをドロップ対象として登録する", () => {
    renderToStaticMarkup(
      createElement(AttackGroupSlot, {
        canChain: false,
        canPlace: true,
        catalog: createGameBoardFixture("self-slot").catalog,
        group: undefined,
        isSelf: true,
        slotIndex: 0,
      }),
    );

    expect(useDroppable).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: false }),
    );
  });
});
