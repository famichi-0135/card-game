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
    ).toHaveLength(9);
    expect(
      definitions.filter((definition) => definition.cardType === "attack"),
    ).toHaveLength(15);
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
      ).toHaveLength(3);
    }

    const costs = definitions
      .filter((definition) => definition.cardType !== "mana")
      .map((definition) => definition.cost);
    expect(Math.max(...costs)).toBeLessThanOrEqual(3);
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
});
