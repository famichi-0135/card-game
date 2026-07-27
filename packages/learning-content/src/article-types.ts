import type { CardDefinitionId } from "@disastar/game-engine/contracts";

export const LEARNING_CATEGORIES = [
  "disaster-information",
  "preparedness-action",
  "preparedness-service",
] as const;

export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];

export type LearningArticle = Readonly<{
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: LearningCategory;
  tags: readonly string[];
  sourceName: string;
  sourceUrl: string;
  reviewedAt: string;
  status: "published" | "draft";
  body: string;
  relatedCardDefinitionIds: readonly CardDefinitionId[];
}>;

export type MatchedLearningArticle = LearningArticle &
  Readonly<{
    matchedCardDefinitionIds: readonly CardDefinitionId[];
  }>;
