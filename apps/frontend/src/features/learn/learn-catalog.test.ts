import { describe, expect, it } from "vitest";
import {
  getLearnArticle,
  getLearnArticles,
  LEARN_CATEGORIES,
  learnArticles,
} from "./learn-catalog.ts";

describe("防災情報カタログ", () => {
  it("カテゴリで記事を絞り込み、未指定時は全記事を返す", () => {
    expect(getLearnArticles(null)).toBe(learnArticles);

    for (const category of LEARN_CATEGORIES) {
      const articles = getLearnArticles(category);
      expect(articles.length).toBeGreaterThan(0);
      expect(articles.every((article) => article.category === category)).toBe(
        true,
      );
    }
  });

  it("存在しない slug は記事として解決しない", () => {
    expect(getLearnArticle("missing-article")).toBeUndefined();
  });

  it("読み込んだ記事は表示に必要なメタデータを満たす", () => {
    expect(learnArticles.length).toBeGreaterThan(0);
    for (const article of learnArticles) {
      expect(article.title).not.toHaveLength(0);
      expect(article.summary).not.toHaveLength(0);
      expect(article.tags.length).toBeGreaterThan(0);
      expect(article.sourceUrl).toMatch(/^https:\/\//);
      expect(article.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
