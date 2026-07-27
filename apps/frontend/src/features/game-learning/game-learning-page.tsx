import {
  learningArticles,
  selectLearningArticles,
} from "@disastar/learning-content";
import { Link } from "react-router";
import { ApiClientError } from "../../app/api-client.ts";
import { useGameLearningContext } from "../game-board/hooks/use-game-board-data.ts";
import { getLearnCategoryLabel } from "../learn/learn-catalog.ts";

export function GameLearningPage({ gameId }: { gameId: string }) {
  const learningContext = useGameLearningContext(gameId, true);

  if (learningContext.isPending) {
    return <GameLearningMessage title="学習コンテンツを読み込んでいます" />;
  }
  if (learningContext.isError || learningContext.data === undefined) {
    return (
      <GameLearningMessage
        title={getLearningContextErrorMessage(learningContext.error)}
        gameId={gameId}
      />
    );
  }

  const selectedCards = new Map(
    learningContext.data.selectedCards.map((card) => [
      card.cardDefinitionId,
      card,
    ]),
  );
  const articles = selectLearningArticles(
    learningContext.data.selectedCards.map(
      ({ cardDefinitionId }) => cardDefinitionId,
    ),
    learningArticles,
  );

  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 py-4">
          <Link
            className="text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/"
          >
            DISASTAR CARD GAME
          </Link>
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to={`/games/${encodeURIComponent(gameId)}`}
          >
            対戦結果へ戻る
          </Link>
        </header>

        <section className="border-b border-slate-300 py-8">
          <p className="text-sm font-semibold text-slate-600">GAME LEARNING</p>
          <h1 className="mt-2 text-3xl font-semibold">この対戦から学ぶ</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            対戦で実際に使用したカードに関連する防災情報です。災害時の行動は、自治体などの最新の公式情報を優先してください。
          </p>
        </section>

        <section className="py-8" aria-labelledby="used-cards-title">
          <h2 className="text-lg font-semibold" id="used-cards-title">
            関連した使用カード
          </h2>
          {learningContext.data.selectedCards.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              この対戦では、現在公開中の記事に関連するカードは使用されませんでした。
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {learningContext.data.selectedCards.map((card) => (
                <li
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  key={card.cardDefinitionId}
                >
                  {card.cardName}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="border-t border-slate-300 py-8"
          aria-labelledby="recommended-articles-title"
        >
          <h2 className="text-lg font-semibold" id="recommended-articles-title">
            おすすめの記事
          </h2>
          {articles.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              関連する記事はまだありません。防災情報一覧から、地域に合う情報を確認してください。
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {articles.map((article) => (
                <article
                  className="rounded border border-slate-300 bg-white p-5"
                  key={article.id}
                >
                  <p className="text-sm font-semibold text-slate-600">
                    {getLearnCategoryLabel(article.category)}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      to={`/learn/${article.slug}`}
                    >
                      {article.title}
                    </Link>
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {article.summary}
                  </p>
                  <p className="mt-4 text-xs text-slate-500">
                    関連カード:{" "}
                    {article.matchedCardDefinitionIds
                      .map(
                        (cardDefinitionId) =>
                          selectedCards.get(cardDefinitionId)?.cardName ??
                          cardDefinitionId,
                      )
                      .join("、")}
                  </p>
                </article>
              ))}
            </div>
          )}
          <Link
            className="mt-6 inline-flex rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/learn"
          >
            防災情報一覧を見る
          </Link>
        </section>
      </div>
    </main>
  );
}

function GameLearningMessage({
  gameId,
  title,
}: {
  gameId?: string;
  title: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-slate-950">
      <section className="w-full max-w-md rounded border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">GAME LEARNING</p>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <Link
          className="mt-6 inline-flex rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          to={
            gameId === undefined ? "/" : `/games/${encodeURIComponent(gameId)}`
          }
        >
          {gameId === undefined ? "対戦画面の入口へ戻る" : "対戦結果へ戻る"}
        </Link>
      </section>
    </main>
  );
}

function getLearningContextErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return "この対戦の学習コンテンツは閲覧できません";
    }
    if (error.status === 404) {
      return "学習コンテンツの保持期間が終了しました";
    }
    if (error.status === 409) {
      return "対戦終了後に学習コンテンツを確認できます";
    }
  }
  return "学習コンテンツを取得できませんでした";
}
