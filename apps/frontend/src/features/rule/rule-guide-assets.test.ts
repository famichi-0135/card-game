import { describe, expect, it } from "vitest";
import { RULE_GUIDE_SECTIONS } from "./rule-guide.ts";

describe("ルール解説のR2画像アセット", () => {
  it("全セクションが不変キーの同一オリジンR2 URLを持つ", () => {
    for (const section of RULE_GUIDE_SECTIONS) {
      const source = section.illustration.src;

      expect(source).toMatch(
        /^\/game-assets\/ui\/rule-guide\/[a-z-]+\.[a-f0-9]{64}\.png$/,
      );
    }
  });
});
