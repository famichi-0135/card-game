import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DragEndEvent } from "@dnd-kit/react";
import type {
  GameCommand,
  PlayerGameView,
  PublicCardCatalog,
} from "@disastar/game-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyGameBoardActionError } from "./game-board.tsx";
import { isHandCardDraggable } from "./components/hand-card.tsx";
import { createGameBoardFixture } from "./fixtures/game-board-fixture.ts";
import {
  type GameBoardActionErrorCode,
  useGameBoardActions,
} from "./hooks/use-game-board-actions.ts";

const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/toast", () => ({
  toast: { add: toastAdd },
}));

describe("ゲーム盤面の無効操作フィードバック", () => {
  beforeEach(() => {
    toastAdd.mockReset();
  });

  it("少なくとも一つの操作候補がある手札だけをドラッグ可能にする", () => {
    const fixture = createGameBoardFixture("drag-availability");
    const actionableCard = fixture.availableActions.handCards["hand-flood"];

    expect(isHandCardDraggable(actionableCard)).toBe(true);
    expect(
      isHandCardDraggable({
        ...actionableCard,
        placeAttack: {
          available: false,
          unavailableReason: "NOT_CURRENT_PLAYER",
          slotIndices: [],
        },
        chainAttack: {
          available: false,
          unavailableReason: "NOT_CURRENT_PLAYER",
          targetGroupIds: [],
        },
        discard: { available: false, unavailableReason: "NOT_CURRENT_PLAYER" },
        playSupport: {
          available: false,
          unavailableReason: "NOT_CURRENT_PLAYER",
          effectSelections: [],
        },
      }),
    ).toBe(false);
  });

  it("無効なドロップではコマンドを送らず、操作別の理由を通知する", () => {
    const placementFixture = createGameBoardFixture("invalid-placement");
    const supportFixture = createGameBoardFixture("invalid-support", "support");

    expectInvalidDrop({
      catalog: placementFixture.catalog,
      cardInstanceId: "hand-flood",
      expectedReason: "INVALID_TARGET",
      target: { side: "self", slotIndex: 2 },
      view: placementFixture.view,
    });
    expectInvalidDrop({
      catalog: placementFixture.catalog,
      cardInstanceId: "hand-earthquake",
      expectedReason: "CHAIN_NOT_ALLOWED",
      target: {
        groupId: "self-group-1",
        side: "self",
        slotIndex: 2,
      },
      view: placementFixture.view,
    });
    expectInvalidDrop({
      catalog: supportFixture.catalog,
      cardInstanceId: "hand-flood",
      expectedReason: "INVALID_PHASE",
      target: { kind: "discard-zone", side: "self" },
      view: supportFixture.view,
    });
    expectInvalidDrop({
      catalog: supportFixture.catalog,
      cardInstanceId: "hand-flood",
      expectedReason: "INVALID_CARD_TYPE",
      target: { kind: "support-zone", side: "self" },
      view: supportFixture.view,
    });
  });

  it.each([
    ["INVALID_TARGET", "選択された対象は無効です。"],
    ["CHAIN_NOT_ALLOWED", "このカードに連鎖（重ねがけ）することはできません。"],
    ["INVALID_PHASE", "現在のフェーズでは配置できません。"],
    ["INVALID_CARD_TYPE", "このゾーンには配置できないカードです。"],
  ] as const)(
    "%s を利用者向けの文言でトースト表示する",
    (reason, description) => {
      notifyGameBoardActionError(reason);

      expect(toastAdd).toHaveBeenCalledWith({
        description,
        title: "配置できません",
        type: "error",
      });
    },
  );
});

function expectInvalidDrop({
  catalog,
  cardInstanceId,
  expectedReason,
  target,
  view,
}: {
  catalog: PublicCardCatalog;
  cardInstanceId: string;
  expectedReason: GameBoardActionErrorCode;
  target: Record<string, string | number>;
  view: PlayerGameView;
}) {
  const onActionError = vi.fn();
  const onCommand = vi.fn<(command: GameCommand) => void>();
  const handleDragEnd = renderDragHandler({
    catalog,
    onActionError,
    onCommand,
    view,
  });

  handleDragEnd({
    canceled: false,
    operation: {
      source: { data: { cardInstanceId } },
      target: { data: target },
    },
  } as unknown as DragEndEvent);

  expect(onActionError).toHaveBeenCalledWith(expectedReason);
  expect(onCommand).not.toHaveBeenCalled();
}

function renderDragHandler({
  catalog,
  onActionError,
  onCommand,
  view,
}: {
  catalog: PublicCardCatalog;
  onActionError: (reason: GameBoardActionErrorCode) => void;
  onCommand: (command: GameCommand) => void;
  view: PlayerGameView;
}): (event: DragEndEvent) => void {
  let handleDragEnd: ((event: DragEndEvent) => void) | undefined;

  function ActionHarness() {
    const actions = useGameBoardActions({
      catalog,
      onActionError,
      onCommand,
      preview: false,
      view,
    });
    handleDragEnd = actions.handleDragEnd;
    return null;
  }

  renderToStaticMarkup(createElement(ActionHarness));

  if (handleDragEnd === undefined) {
    throw new Error("ドラッグ操作を初期化できませんでした。");
  }
  return handleDragEnd;
}
