import { describe, expect, it } from "vitest";
import { selectLearningArticles, type LearningArticle } from "../src/index.js";

const articles: readonly LearningArticle[] = [
  {
    id: "hazard-map-guide",
    slug: "hazard-map-guide",
    title: "ハザードマップで地域の危険性を確認する",
    summary: "地域の災害リスクを確認します。",
    category: "preparedness-action",
    tags: ["ハザードマップ"],
    sourceName: "国土地理院",
    sourceUrl: "https://example.com/hazard-map",
    reviewedAt: "2026-07-27",
    status: "published",
    relatedCardDefinitionIds: ["countermeasure-attack-1"],
    body: "本文",
  },
  {
    id: "typhoon-preparation",
    slug: "typhoon-preparation",
    title: "台風に備える",
    summary: "台風の前に準備することを確認します。",
    category: "disaster-information",
    tags: ["台風"],
    sourceName: "気象庁",
    sourceUrl: "https://example.com/typhoon",
    reviewedAt: "2026-07-27",
    status: "published",
    relatedCardDefinitionIds: ["disaster-attack-8", "countermeasure-attack-1"],
    body: "本文",
  },
  {
    id: "draft-article",
    slug: "draft-article",
    title: "非公開の記事",
    summary: "表示してはいけません。",
    category: "preparedness-service",
    tags: ["下書き"],
    sourceName: "例",
    sourceUrl: "https://example.com/draft",
    reviewedAt: "2026-07-27",
    status: "draft",
    relatedCardDefinitionIds: ["disaster-attack-8"],
    body: "本文",
  },
];

describe("対戦後の学習記事抽出", () => {
  it("選択カードに関連する公開記事だけを、最初に一致したカード順で一度ずつ返す", () => {
    expect(
      selectLearningArticles(
        ["disaster-attack-8", "countermeasure-attack-1"],
        articles,
      ),
    ).toEqual([
      expect.objectContaining({
        id: "typhoon-preparation",
        matchedCardDefinitionIds: ["disaster-attack-8"],
      }),
      expect.objectContaining({
        id: "hazard-map-guide",
        matchedCardDefinitionIds: ["countermeasure-attack-1"],
      }),
    ]);
  });
});
