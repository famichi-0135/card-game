import { describe, expect, it } from "vitest";
import { projectPublicCardCatalog } from "../src/index.js";
import type { CardCatalog } from "../src/contracts/index.js";

describe("公開カードカタログ", () => {
  it("効果ハンドラーと内部設定を公開せず、対象選択に必要な情報だけを返す", () => {
    const catalog = {
      version: "catalog-v1",
      definitions: {
        "support-1": {
          id: "support-1",
          name: "公開テストカード",
          faction: "disaster",
          attribute: "attributeA",
          cardType: "support",
          cost: 2,
          duration: "instant",
          effects: [
            {
              effectId: "internal-effect",
              type: "custom",
              handlerId: "private-handler",
              config: { privateValue: "do-not-leak" },
              activationType: "onPlay",
              targetRule: {
                required: true,
                minTargets: 1,
                maxTargets: 1,
                side: "opponent",
                zones: ["attackGroup"],
                allowSourceCard: false,
              },
            },
          ],
        },
      },
    } as unknown as CardCatalog;

    const projected = projectPublicCardCatalog(catalog);
    const serialized = JSON.stringify(projected);

    expect(projected).toEqual({
      version: "catalog-v1",
      definitions: {
        "support-1": expect.objectContaining({
          id: "support-1",
          cost: 2,
          duration: "instant",
          imageAssetId: null,
          interaction: {
            chainableCardDefinitionIds: [],
            effects: [
              {
                effectId: "internal-effect",
                activationType: "onPlay",
                target: {
                  required: true,
                  minTargets: 1,
                  maxTargets: 1,
                  side: "opponent",
                  zones: ["attackGroup"],
                  allowSourceCard: false,
                  selectionOrder: "independent",
                },
              },
            ],
          },
        }),
      },
    });
    expect(serialized).not.toContain("private-handler");
    expect(serialized).not.toContain("privateValue");
    expect(serialized).not.toContain("do-not-leak");
  });
});
