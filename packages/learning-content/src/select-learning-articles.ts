import type { CardDefinitionId } from "@disastar/game-engine/contracts";
import type {
  LearningArticle,
  MatchedLearningArticle,
} from "./article-types.js";

export function getPublishedLearningArticles(
  articles: readonly LearningArticle[],
): readonly LearningArticle[] {
  return articles.filter((article) => article.status === "published");
}

export function selectLearningArticles(
  playedCardDefinitionIds: readonly CardDefinitionId[],
  articles: readonly LearningArticle[],
): readonly MatchedLearningArticle[] {
  const playedCardIds = new Set(playedCardDefinitionIds);
  const publishedArticles = getPublishedLearningArticles(articles);

  const selectedArticleIds = new Set<string>();

  return playedCardDefinitionIds.flatMap((cardDefinitionId) =>
    publishedArticles.flatMap((article) => {
      if (
        !playedCardIds.has(cardDefinitionId) ||
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
