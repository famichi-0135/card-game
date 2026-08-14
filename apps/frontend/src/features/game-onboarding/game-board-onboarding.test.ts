import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameBoardOnboardingPreview } from "./game-board-onboarding-preview.tsx";
import { gameBoardOnboardingSteps } from "./game-board-onboarding-steps.ts";

describe("ゲームボードオンボーディング", () => {
  it("説明対象を8段階で提供する", () => {
    expect(gameBoardOnboardingSteps).toHaveLength(8);
    expect(gameBoardOnboardingSteps.map((step) => step.element)).toEqual([
      '[data-onboarding-target="game-progress"]',
      '[data-onboarding-target="hand"]',
      '[data-onboarding-target="battle-zone"]',
      '[data-onboarding-target="attack-slot"]',
      '[data-onboarding-target="attack-chain"]',
      '[data-onboarding-target="discard-zone"]',
      '[data-onboarding-target="support-zone"]',
      '[data-onboarding-target="phase-finish"]',
    ]);
  });

  it("実ゲームを開始しないプレビューに各説明対象を描画する", () => {
    const html = renderToStaticMarkup(
      createElement(GameBoardOnboardingPreview),
    );

    for (const step of gameBoardOnboardingSteps) {
      const target = step.element.match(/"(.+)"/)?.[1];
      expect(target).toBeDefined();
      const attribute = `data-onboarding-target="${target}"`;
      expect(html.split(attribute)).toHaveLength(2);
    }
    expect(html).toContain("このガイド中に実際の対戦は開始されません");
  });
});
