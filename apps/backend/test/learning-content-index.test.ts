import { describe, expect, it } from "vitest";
import { learningArticles } from "@disastar/learning-content";
import { gameEngineContext } from "../src/game-engine/runtime.js";

describe("学習記事インデックス", () => {
  it("公開済み記事が現行カードカタログに存在するカードだけを関連付ける", () => {
    for (const article of learningArticles) {
      expect(article.status).toBe("published");
      for (const cardDefinitionId of article.relatedCardDefinitionIds) {
        expect(
          gameEngineContext.cardCatalog.definitions[cardDefinitionId],
        ).toBeDefined();
      }
    }
  });

  it("現行カードカタログのすべてのカード定義に公開記事が紐づく", () => {
    const relatedCardDefinitionIds = new Set(
      learningArticles
        .filter((article) => article.status === "published")
        .flatMap((article) => article.relatedCardDefinitionIds),
    );
    const cardDefinitionIdsWithoutArticle = Object.keys(
      gameEngineContext.cardCatalog.definitions,
    ).filter(
      (cardDefinitionId) => !relatedCardDefinitionIds.has(cardDefinitionId),
    );

    expect(cardDefinitionIdsWithoutArticle).toEqual([]);
  });
});
