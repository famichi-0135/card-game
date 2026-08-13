import { lazy, Suspense, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  AppPanel,
  AppShell,
  PageHeader,
  appButtonClassName,
} from "../../components/application-ui.tsx";
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
      <PageHeader
        description="災害が起きる前に、住んでいる地域の危険性と情報の確かめ方を確認します。"
        eyebrow="DISASTER PREPAREDNESS"
        title="防災を学ぶ"
      />

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
          className="text-sm font-medium text-[#bcdcf0] underline decoration-[#487694] underline-offset-4 hover:text-[#e8f6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
          to="/learn"
        >
          防災情報一覧へ戻る
        </Link>
        <p className="mt-8 text-[11px] font-medium tracking-[.18em] text-[#5798c9]">
          {getLearnCategoryLabel(article.category)}
        </p>
        <h1 className="mt-3 text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.12] tracking-[-.04em] text-[#edf3f7]">
          {article.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#b4c4cd]">
          {article.summary}
        </p>
        <ArticleTags tags={article.tags} />

        <Suspense
          fallback={
            <div className="mt-10 max-w-3xl border-y border-[#2a3d4b] py-8 text-sm text-[#91a5b4]">
              記事を読み込んでいます。
            </div>
          }
        >
          <LearnArticleBody body={article.body} />
        </Suspense>

        <AppPanel className="mt-8 max-w-3xl" label="SOURCE INFORMATION">
          <dl className="grid gap-5 text-sm">
            <div>
              <dt className="font-semibold text-[#dce9ef]">出典</dt>
              <dd className="mt-1">
                <a
                  className="text-[#bcdcf0] underline decoration-[#487694] underline-offset-4 hover:text-[#e8f6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
                  href={article.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {article.sourceName}（外部サイト）
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#dce9ef]">最終確認日</dt>
              <dd className="mt-1 text-[#b4c4cd]">{article.reviewedAt}</dd>
            </div>
          </dl>
        </AppPanel>

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
      className={`border px-3 py-2 text-sm font-medium tracking-[.04em] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#75bced] ${
        isSelected
          ? "border-[#b98d3f] bg-[linear-gradient(180deg,rgba(101,74,30,.92),rgba(47,34,17,.98))] text-[#fff0c9]"
          : "border-[#315b7e] bg-[#07151f]/85 text-[#cce8fa] hover:border-[#72b7e5] hover:bg-[#102536]"
      }`}
      to={to}
    >
      {children}
    </Link>
  );
}

function ArticleSummary({ article }: { article: LearnArticle }) {
  return (
    <AppPanel className="transition hover:-translate-y-0.5 hover:border-[#527895] motion-reduce:transform-none">
      <p className="text-[11px] font-medium tracking-[.16em] text-[#5798c9]">
        {getLearnCategoryLabel(article.category)}
      </p>
      <h2 className="mt-3 text-xl font-semibold text-[#e8f1f5]">
        <Link
          className="underline decoration-[#527895] underline-offset-4 hover:text-[#8ec7ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
          to={`/learn/${article.slug}`}
        >
          {article.title}
        </Link>
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#a7b8c2]">{article.summary}</p>
      <ArticleTags tags={article.tags} />
      <p className="mt-4 text-xs text-[#718895]">
        最終確認日: {article.reviewedAt}
      </p>
    </AppPanel>
  );
}

function ArticleTags({ tags }: { tags: readonly string[] }) {
  return (
    <ul aria-label="記事のタグ" className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          className="border border-[#2f4a5e] bg-[#07131c]/70 px-2 py-1 text-xs text-[#9fb5c3]"
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
        <p className="text-[11px] font-medium tracking-[.18em] text-[#5798c9]">
          DISASTER PREPAREDNESS
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#edf3f7]">
          記事が見つかりません
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#91a5b4]">
          指定された記事は存在しないか、公開を終了しています。
        </p>
        <Link className={`mt-6 ${appButtonClassName.secondary}`} to="/learn">
          防災情報一覧へ戻る
        </Link>
      </section>
    </LearnLayout>
  );
}

function EmergencyNotice() {
  return (
    <aside className="mt-8 max-w-3xl border border-[#8d6b2d] bg-[linear-gradient(145deg,rgba(64,48,18,.68),rgba(20,17,8,.92))] p-5 text-sm leading-6 text-[#f3dfab] shadow-[inset_0_1px_0_rgba(255,238,185,.08)]">
      <h2 className="font-semibold text-[#ffe6a2]">緊急時の注意</h2>
      <p className="mt-2">
        このページはリアルタイムの避難判断には使用しないでください。災害の危険があるときは、自治体、気象庁などの最新の公式情報と避難情報を確認してください。
      </p>
    </aside>
  );
}

function LearnLayout({ children }: { children: ReactNode }) {
  return <AppShell contentClassName="max-w-5xl">{children}</AppShell>;
}
