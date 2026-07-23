import { describe, expect, it } from "vitest";
import { getPhasePresentation } from "./phase-presentation.ts";

const baseView = {
  firstPlayerId: "player-1",
  secondPlayerId: "player-2",
  viewerPlayerId: "player-1",
  self: { supportFinished: false },
  opponent: { supportFinished: false },
} as const;

describe("盤面フェーズ表示", () => {
  it("配置フェーズの担当者だけに自分のターンと表示する", () => {
    expect(
      getPhasePresentation({ ...baseView, phase: "firstPlayerPlacement" }),
    ).toMatchObject({
      label: "あなたの配置",
      instruction: expect.stringContaining("あなたのターン"),
    });

    expect(
      getPhasePresentation({ ...baseView, phase: "secondPlayerPlacement" }),
    ).toMatchObject({
      label: "相手の配置",
      instruction: expect.stringContaining("相手のターン"),
    });
  });

  it("後攻側では配置フェーズの見え方を反転する", () => {
    const view = { ...baseView, viewerPlayerId: "player-2" };

    expect(
      getPhasePresentation({ ...view, phase: "firstPlayerPlacement" }),
    ).toMatchObject({ label: "相手の配置" });
    expect(
      getPhasePresentation({ ...view, phase: "secondPlayerPlacement" }),
    ).toMatchObject({ label: "あなたの配置" });
  });

  it("サポート終了後は相手を待つ状態を表示する", () => {
    expect(
      getPhasePresentation({
        ...baseView,
        phase: "support",
        self: { supportFinished: true },
      }),
    ).toMatchObject({ instruction: expect.stringContaining("相手") });
  });
});
