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

  it("実ゲームの操作では、受理応答が届くまで盤面のカード・みなもと・フェーズを変更しない", () => {
    const fixture = createGameBoardFixture("no-optimistic-update");
    const onActionError = vi.fn();
    const onCommand = vi.fn<(command: GameCommand) => void>();
    const handleDragEnd = renderDragHandler({
      catalog: fixture.catalog,
      onActionError,
      onCommand,
      view: fixture.view,
    });
    const handBefore = fixture.view.self.hand;
    const manaBefore = fixture.view.self.mana;
    const phaseBefore = fixture.view.phase;

    handleDragEnd({
      canceled: false,
      operation: {
        source: { data: { cardInstanceId: "hand-flood" } },
        target: { data: { side: "self", slotIndex: 0 } },
      },
    } as unknown as DragEndEvent);

    expect(onActionError).not.toHaveBeenCalled();
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cardInstanceId: "hand-flood",
        type: "PLACE_ATTACK_CARD",
      }),
    );
    expect(fixture.view.self.hand).toBe(handBefore);
    expect(fixture.view.self.mana).toBe(manaBefore);
    expect(fixture.view.phase).toBe(phaseBefore);
  });

  it("操作候補のない手札をキーボード選択しても、選択状態にせず理由を通知する", () => {
    const fixture = createGameBoardFixture("keyboard-unavailable");
    const onActionError = vi.fn();
    const selectCard = renderCardSelector({
      catalog: fixture.catalog,
      onActionError,
      onCommand: vi.fn(),
      view: {
        ...fixture.view,
        phase: "secondPlayerPlacement",
        phaseSequence: fixture.view.phaseSequence + 1,
      },
    });

    selectCard("hand-flood");

    expect(onActionError).toHaveBeenCalledWith("NOT_CURRENT_PLAYER");
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

function renderCardSelector({
  catalog,
  onActionError,
  onCommand,
  view,
}: {
  catalog: PublicCardCatalog;
  onActionError: (reason: GameBoardActionErrorCode) => void;
  onCommand: (command: GameCommand) => void;
  view: PlayerGameView;
}): (cardInstanceId: string) => void {
  let selectCard: ((cardInstanceId: string) => void) | undefined;

  function ActionHarness() {
    const actions = useGameBoardActions({
      catalog,
      onActionError,
      onCommand,
      preview: false,
      view,
    });
    selectCard = actions.selectCard;
    return null;
  }

  renderToStaticMarkup(createElement(ActionHarness));

  if (selectCard === undefined) {
    throw new Error("キーボード操作を初期化できませんでした。");
  }
  return selectCard;
}
