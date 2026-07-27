import type { CardDefinitionId } from "@disastar/game-engine/contracts";
import type {
  LearningArticle,
  MatchedLearningArticle,
} from "./article-types.js";

export function selectLearningArticles(
  playedCardDefinitionIds: readonly CardDefinitionId[],
  articles: readonly LearningArticle[],
): readonly MatchedLearningArticle[] {
  const playedCardIds = new Set(playedCardDefinitionIds);

  const selectedArticleIds = new Set<string>();

  return playedCardDefinitionIds.flatMap((cardDefinitionId) =>
    articles.flatMap((article) => {
      if (
        !playedCardIds.has(cardDefinitionId) ||
        article.status !== "published" ||
        selectedArticleIds.has(article.id) ||
        !article.relatedCardDefinitionIds.includes(cardDefinitionId)
      ) {
        return [];
      }
      selectedArticleIds.add(article.id);
      return [{ ...article, matchedCardDefinitionIds: [cardDefinitionId] }];
    }),
  );
}
