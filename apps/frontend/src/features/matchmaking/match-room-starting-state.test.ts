import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PreparingMatchState,
  StartingMatchRecoveryActions,
} from "./match-room.tsx";

describe("StartingMatchRecoveryActions", () => {
  it("参加者には同じ開始処理を再試行する操作を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(StartingMatchRecoveryActions, {
        isPending: false,
        onAction: () => {},
        role: "opponent",
      }),
    );

    expect(html).toContain("対戦開始を再試行する");
  });

  it("作成者には開始中の部屋を取り消す操作を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(StartingMatchRecoveryActions, {
        isPending: false,
        onAction: () => {},
        role: "owner",
      }),
    );

    expect(html).toContain("招待部屋を取り消す");
    expect(html).not.toContain("対戦開始を再試行する");
  });
});

describe("PreparingMatchState", () => {
  it("ゲームを開始せず、双方の準備状態を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(PreparingMatchState, {
        isOwner: false,
        isReady: false,
        isReadying: false,
        onReady: () => {},
        onOpenOnboarding: () => {},
        opponentReady: false,
        onboardingTriggerRef: { current: null },
        ownerReady: true,
      }),
    );

    expect(html).toContain("ゲームの制限時間はまだ始まりません");
    expect(html).toContain("作成者");
    expect(html).toContain("参加者");
    expect(html).toContain("準備完了");
  });
});
