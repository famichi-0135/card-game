import { lazy, Suspense, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  getLearnArticle,
  getLearnArticles,
  getLearnCategoryLabel,
  isLearnCategory,
  LEARN_CATEGORIES,
  type LearnArticle,
  type LearnCategory,
} from "./learn-catalog.ts";

const allCategoryLabel = "すべて";
const LearnArticleBody = lazy(() => import("./learn-article-body.tsx"));

export function LearnIndexRoute() {
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");
  const selectedCategory = isLearnCategory(requestedCategory)
    ? requestedCategory
    : null;
  const articles = getLearnArticles(selectedCategory);

  return (
    <LearnLayout>
      <div className="border-b border-slate-300 pb-8">
        <p className="text-sm font-semibold text-slate-600">防災情報</p>
        <h1 className="mt-2 text-3xl font-semibold">防災を学ぶ</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          災害が起きる前に、住んでいる地域の危険性と情報の確かめ方を確認します。
        </p>
      </div>

      <nav
        aria-label="防災情報のカテゴリ"
        className="flex flex-wrap gap-2 py-6"
      >
        <CategoryLink category={null} selectedCategory={selectedCategory}>
          {allCategoryLabel}
        </CategoryLink>
        {LEARN_CATEGORIES.map((category) => (
          <CategoryLink
            category={category}
            key={category}
            selectedCategory={selectedCategory}
          >
            {getLearnCategoryLabel(category)}
          </CategoryLink>
        ))}
      </nav>

      <section aria-label="防災情報の記事一覧" className="grid gap-3 pb-10">
        {articles.map((article) => (
          <ArticleSummary article={article} key={article.slug} />
        ))}
      </section>
    </LearnLayout>
  );
}

export function LearnArticleRoute() {
  const { slug } = useParams();
  const article = slug === undefined ? undefined : getLearnArticle(slug);

  if (article === undefined) {
    return <LearnArticleNotFound />;
  }

  return (
    <LearnLayout>
      <article className="pb-10">
        <Link
          className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          to="/learn"
        >
          防災情報一覧へ戻る
        </Link>
        <p className="mt-8 text-sm font-semibold text-slate-600">
          {getLearnCategoryLabel(article.category)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{article.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
          {article.summary}
        </p>
        <ArticleTags tags={article.tags} />

        <Suspense
          fallback={
            <div className="mt-10 max-w-3xl border-y border-slate-300 py-8 text-sm text-slate-600">
              記事を読み込んでいます。
            </div>
          }
        >
          <LearnArticleBody body={article.body} />
        </Suspense>

        <dl className="mt-8 grid max-w-3xl gap-5 rounded border border-slate-300 bg-white p-5 text-sm">
          <div>
            <dt className="font-semibold text-slate-700">出典</dt>
            <dd className="mt-1">
              <a
                className="text-slate-800 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                href={article.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {article.sourceName}（外部サイト）
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">最終確認日</dt>
            <dd className="mt-1 text-slate-700">{article.reviewedAt}</dd>
          </div>
        </dl>

        <EmergencyNotice />
      </article>
    </LearnLayout>
  );
}

function CategoryLink({
  category,
  children,
  selectedCategory,
}: {
  category: LearnCategory | null;
  children: string;
  selectedCategory: LearnCategory | null;
}) {
  const isSelected = category === selectedCategory;
  const to = category === null ? "/learn" : `/learn?category=${category}`;

  return (
    <Link
      aria-current={isSelected ? "page" : undefined}
      className={`rounded border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
        isSelected
          ? "border-slate-800 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      }`}
      to={to}
    >
      {children}
    </Link>
  );
}

function ArticleSummary({ article }: { article: LearnArticle }) {
  return (
    <article className="rounded border border-slate-300 bg-white p-5">
      <p className="text-sm font-semibold text-slate-600">
        {getLearnCategoryLabel(article.category)}
      </p>
      <h2 className="mt-2 text-xl font-semibold">
        <Link
          className="underline underline-offset-4 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          to={`/learn/${article.slug}`}
        >
          {article.title}
        </Link>
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">{article.summary}</p>
      <ArticleTags tags={article.tags} />
      <p className="mt-4 text-xs text-slate-500">
        最終確認日: {article.reviewedAt}
      </p>
    </article>
  );
}

function ArticleTags({ tags }: { tags: readonly string[] }) {
  return (
    <ul aria-label="記事のタグ" className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
          key={tag}
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

function LearnArticleNotFound() {
  return (
    <LearnLayout>
      <section className="max-w-xl py-10">
        <p className="text-sm font-semibold text-slate-600">防災情報</p>
        <h1 className="mt-2 text-2xl font-semibold">記事が見つかりません</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          指定された記事は存在しないか、公開を終了しています。
        </p>
        <Link
          className="mt-6 inline-flex rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          to="/learn"
        >
          防災情報一覧へ戻る
        </Link>
      </section>
    </LearnLayout>
  );
}

function EmergencyNotice() {
  return (
    <aside className="mt-8 max-w-3xl rounded border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
      <h2 className="font-semibold">緊急時の注意</h2>
      <p className="mt-2">
        このページはリアルタイムの避難判断には使用しないでください。災害の危険があるときは、自治体、気象庁などの最新の公式情報と避難情報を確認してください。
      </p>
    </aside>
  );
}

function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-300 py-4">
          <Link
            className="text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/"
          >
            DISASTAR CARD GAME
          </Link>
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/"
          >
            対戦準備へ
          </Link>
        </header>
        <div className="py-10">{children}</div>
      </div>
    </main>
  );
}
