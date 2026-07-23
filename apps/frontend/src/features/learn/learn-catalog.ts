export const LEARN_CATEGORIES = [
  "disaster-information",
  "preparedness-action",
  "preparedness-service",
] as const;

export type LearnCategory = (typeof LEARN_CATEGORIES)[number];

export type LearnArticle = Readonly<{
  slug: string;
  title: string;
  summary: string;
  category: LearnCategory;
  tags: readonly string[];
  sourceName: string;
  sourceUrl: string;
  reviewedAt: string;
  body: string;
}>;

const categoryLabels: Record<LearnCategory, string> = {
  "disaster-information": "災害情報",
  "preparedness-action": "防災行動",
  "preparedness-service": "防災サービス",
};

const articleModules = import.meta.glob<string>("./content/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

export const learnArticles: readonly LearnArticle[] = Object.entries(
  articleModules,
)
  .map(([path, source]) => parseLearnArticle(path, source))
  .sort(
    (left, right) =>
      right.reviewedAt.localeCompare(left.reviewedAt) ||
      left.title.localeCompare(right.title, "ja"),
  );

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

function parseLearnArticle(path: string, source: string): LearnArticle {
  const slugMatch = /^\.\/content\/([a-z0-9-]+)\.md$/.exec(path);
  if (slugMatch === null) {
    throw new Error(`防災情報記事のパスが不正です: ${path}`);
  }

  const contentMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(
    source,
  );
  if (contentMatch === null) {
    throw new Error(`防災情報記事のfrontmatterが不正です: ${path}`);
  }

  const fields = parseFrontmatter(contentMatch[1], path);
  const category = requireField(fields, "category", path);
  if (!isLearnCategory(category)) {
    throw new Error(`防災情報記事のカテゴリが不正です: ${path}`);
  }

  const sourceUrl = requireField(fields, "sourceUrl", path);
  const sourceUrlObject = new URL(sourceUrl);
  if (sourceUrlObject.protocol !== "https:") {
    throw new Error(`防災情報記事の出典URLはHTTPSで指定します: ${path}`);
  }

  const reviewedAt = requireField(fields, "reviewedAt", path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) {
    throw new Error(`防災情報記事の確認日が不正です: ${path}`);
  }

  const tags = requireField(fields, "tags", path)
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  if (tags.length === 0) {
    throw new Error(`防災情報記事のタグがありません: ${path}`);
  }

  return Object.freeze({
    slug: slugMatch[1],
    title: requireField(fields, "title", path),
    summary: requireField(fields, "summary", path),
    category,
    tags: Object.freeze(tags),
    sourceName: requireField(fields, "sourceName", path),
    sourceUrl: sourceUrlObject.toString(),
    reviewedAt,
    body: contentMatch[2].trim(),
  });
}

function parseFrontmatter(
  source: string,
  path: string,
): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};

  for (const line of source.split(/\r?\n/)) {
    const match = /^([a-zA-Z][a-zA-Z0-9]*):\s*(.+)$/.exec(line);
    if (match === null || fields[match[1]] !== undefined) {
      throw new Error(`防災情報記事のfrontmatterが不正です: ${path}`);
    }
    fields[match[1]] = match[2].trim();
  }

  return Object.freeze(fields);
}

function requireField(
  fields: Readonly<Record<string, string>>,
  field: string,
  path: string,
): string {
  const value = fields[field];
  if (value === undefined || value.length === 0) {
    throw new Error(`防災情報記事の${field}がありません: ${path}`);
  }
  return value;
}
