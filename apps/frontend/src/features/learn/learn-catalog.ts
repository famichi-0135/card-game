import {
  LEARNING_CATEGORIES,
  learningArticles,
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

export const learnArticles = learningArticles;

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
