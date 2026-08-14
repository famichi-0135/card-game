import {
  LEARNING_CATEGORIES,
  getPublishedLearningArticles,
  learningArticles as allLearningArticles,
  type LearningArticle,
  type LearningCategory,
} from "@disastar/learning-content";

export const LEARN_CATEGORIES = LEARNING_CATEGORIES;
export type LearnCategory = LearningCategory;
export type LearnArticle = LearningArticle;

const categoryLabels: Record<LearnCategory, string> = {
  "disaster-information": "災害情報",
  "preparedness-action": "防災行動",
  "preparedness-service": "防災サービス",
};

export const learnArticles = getPublishedLearningArticles(allLearningArticles);

export function getLearnArticle(slug: string): LearnArticle | undefined {
  return learnArticles.find((article) => article.slug === slug);
}

export function getLearnArticles(
  category: LearnCategory | null,
): readonly LearnArticle[] {
  return category === null
    ? learnArticles
    : learnArticles.filter((article) => article.category === category);
}

export function getLearnCategoryLabel(category: LearnCategory): string {
  return categoryLabels[category];
}

export function isLearnCategory(value: string | null): value is LearnCategory {
  return LEARN_CATEGORIES.some((category) => category === value);
}

export function getAvailableTags(
  articles: readonly LearnArticle[],
): readonly string[] {
  const set = new Set<string>();
  for (const article of articles) {
    for (const tag of article.tags) {
      set.add(tag);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

export function filterLearnArticles<T extends LearnArticle>(
  articles: readonly T[],
  options: {
    category?: LearnCategory | null;
    tags?: readonly string[];
  },
): readonly T[] {
  const { category = null, tags = [] } = options;
  return articles.filter((article) => {
    if (category !== null && article.category !== category) {
      return false;
    }
    if (tags.length > 0) {
      const articleTagSet = new Set(article.tags);
      if (!tags.every((tag) => articleTagSet.has(tag))) {
        return false;
      }
    }
    return true;
  });
}
