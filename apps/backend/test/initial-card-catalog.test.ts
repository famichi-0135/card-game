import { describe, expect, it } from "vitest";
import { validateDeck } from "@disastar/game-engine";
import type { Faction } from "@disastar/game-engine/contracts";
import {
  createCountermeasureStarterDeckDefinitionIds,
  createDisasterStarterDeckDefinitionIds,
  gameEngineContext,
} from "../src/game-engine/runtime.js";

describe("初期スターターデッキ", () => {
  it.each([
    ["disaster", createDisasterStarterDeckDefinitionIds()],
    ["countermeasure", createCountermeasureStarterDeckDefinitionIds()],
  ] as const)("%s側は対戦可能な均等30枚構成である", (faction, deck) => {
    const catalog = gameEngineContext.cardCatalog;
    const definitions = deck.map((definitionId) => {
      const definition = catalog.definitions[definitionId];
      if (definition === undefined) {
        throw new Error(`カード定義 ${definitionId} が見つかりません。`);
      }
      return definition;
    });

    expect(deck).toHaveLength(30);
    expect(
      validateDeck(deck, faction as Faction, catalog, gameEngineContext.rules),
    ).toEqual({ valid: true });
    expect(
      definitions.filter((definition) => definition.cardType === "mana"),
    ).toHaveLength(12);
    expect(
      definitions.filter((definition) => definition.cardType === "attack"),
    ).toHaveLength(12);
    expect(
      definitions.filter((definition) => definition.cardType === "support"),
    ).toHaveLength(6);

    for (const attribute of [
      "attributeA",
      "attributeB",
      "attributeC",
    ] as const) {
      expect(
        definitions.filter(
          (definition) =>
            definition.cardType === "mana" &&
            definition.attribute === attribute,
        ),
      ).toHaveLength(4);
    }

    const costs = definitions
      .filter((definition) => definition.cardType !== "mana")
      .map((definition) => definition.cost);
    expect(Math.max(...costs)).toBeLessThanOrEqual(3);
    expect(
      definitions
        .filter((definition) => definition.cardType === "support")
        .map((definition) => definition.id),
    ).toEqual([
      `${faction}-support-group-boost`,
      `${faction}-support-remove-support`,
      `${faction}-support-reduce-mana`,
      `${faction}-support-stamina`,
      `${faction}-support-remove-group`,
      `${faction}-support-destroy-draw`,
    ]);
  });

  it("各属性に段階的な1から3の連鎖軸を含む", () => {
    const catalog = gameEngineContext.cardCatalog;
    for (const faction of ["disaster", "countermeasure"] as const) {
      for (const [first, second, third] of [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 11],
      ]) {
        const firstCard = catalog.definitions[`${faction}-attack-${first}`];
        const secondCard = catalog.definitions[`${faction}-attack-${second}`];
        const thirdCard = catalog.definitions[`${faction}-attack-${third}`];
        if (
          firstCard?.cardType !== "attack" ||
          secondCard?.cardType !== "attack" ||
          thirdCard?.cardType !== "attack"
        ) {
          throw new Error("連鎖用の攻撃カード定義が見つかりません。");
        }

        expect([firstCard.cost, secondCard.cost, thirdCard.cost]).toEqual([
          1, 2, 3,
        ]);
        expect([
          firstCard.basePower,
          secondCard.basePower,
          thirdCard.basePower,
        ]).toEqual([1, 2, 3]);
        expect(firstCard.chainableCardIds).toContain(secondCard.id);
        expect(secondCard.chainableCardIds).toContain(thirdCard.id);
      }
    }
  });

  it("防災素材に対応した名称と学習解説を公開する", () => {
    const catalog = gameEngineContext.cardCatalog;
    const expectedNames = {
      disaster: {
        mana: ["大地のみなもと", "水のみなもと", "空のみなもと"],
        attack: [
          "微小地震",
          "直下型地震",
          "海溝型巨大地震",
          "大雨",
          "河川の氾濫",
          "巨大津波（防潮堤超過）",
          "温帯低気圧",
          "台風",
          "液状化現象",
          "河川遡上（かせんそじょう）",
          "猛烈な偏西風",
        ],
        support: [
          "猛烈な偏西風",
          "ライフラインの寸断・途絶",
          "建物の倒壊",
          "地震火災",
          "土石流",
          "マグマ溜まりの圧力限界",
        ],
      },
      countermeasure: {
        mana: [
          "備える力のみなもと",
          "守る力のみなもと",
          "つながる力のみなもと",
        ],
        attack: [
          "ハザードマップの確認",
          "家具の固定・転倒防止",
          "建物の耐震改修",
          "土のう・水のうの設置",
          "堤防",
          "防潮堤（津波防波堤）",
          "防災行政無線",
          "避難指示の発令",
          "避難ルートの確認",
          "地盤改良（液状化対策）",
          "自助・共助・公助",
        ],
        support: [
          "津波・地震避難訓練",
          "自主防災組織・安否確認",
          "非常用備蓄セット",
          "トリアージ＆応急救護所",
          "緊急安全確保（警戒レベル5）",
          "仮設住宅の建設",
        ],
      },
    } as const;

    for (const faction of ["disaster", "countermeasure"] as const) {
      expect(
        [1, 2, 3].map(
          (number) => catalog.definitions[`${faction}-mana-${number}`]?.name,
        ),
      ).toEqual(expectedNames[faction].mana);
      expect(
        Array.from(
          { length: 11 },
          (_, index) =>
            catalog.definitions[`${faction}-attack-${index + 1}`]?.name,
        ),
      ).toEqual(expectedNames[faction].attack);
      expect(
        [
          "group-boost",
          "remove-support",
          "reduce-mana",
          "stamina",
          "remove-group",
          "destroy-draw",
        ].map(
          (suffix) => catalog.definitions[`${faction}-support-${suffix}`]?.name,
        ),
      ).toEqual(expectedNames[faction].support);
    }

    expect(
      catalog.definitions["disaster-attack-5"]?.presentation?.rulesText,
    ).toContain("河川が氾濫し水があふれ出すことがある");
    expect(
      catalog.definitions["countermeasure-support-destroy-draw"]?.presentation
        ?.rulesText,
    ).toContain(
      "ゲーム上の効果: 使用後すぐに解決されます。カードを1枚引きます。",
    );
  });
});
