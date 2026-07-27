import { describe, expect, it } from "vitest";
import { RULE_GUIDE_SECTIONS, RULE_GUIDE_SETTINGS } from "./rule-guide.ts";

describe("ルール解説の掲載内容", () => {
  it("利用者が対戦を始めるために必要な基本条件を示す", () => {
    expect(RULE_GUIDE_SETTINGS).toMatchObject({
      initialStamina: 25,
      initialHandSize: 5,
      maxAttackGroups: 5,
      maxRounds: 30,
      placementLimitSeconds: 90,
      supportLimitSeconds: 60,
    });
  });

  it("各解説に将来の図解を追加できる情報を持つ", () => {
    expect(RULE_GUIDE_SECTIONS.map((section) => section.id)).toEqual([
      "goal",
      "cards-and-sources",
      "round-flow",
      "attack-and-chain",
      "support",
      "scoring-and-end",
    ]);

    for (const section of RULE_GUIDE_SECTIONS) {
      expect(section.illustration.alt).not.toHaveLength(0);
      expect(section.illustration.caption).not.toHaveLength(0);
    }
  });
});
