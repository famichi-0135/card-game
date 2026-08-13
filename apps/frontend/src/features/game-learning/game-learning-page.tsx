import {
  learningArticles,
  selectLearningArticles,
} from "@disastar/learning-content";
import { Link } from "react-router";
import { ApiClientError } from "../../app/api-client.ts";
import {
  AppEmptyState,
  AppPanel,
  AppShell,
  PageHeader,
  appButtonClassName,
} from "../../components/application-ui.tsx";
import { AccountMenu } from "../account/account-menu.tsx";
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
    <AppShell
      contentClassName="max-w-5xl"
      headerRightSlot={
        <div className="flex items-center gap-3">
          <Link
            className="border border-[#315b7e] px-3 py-2 text-sm font-medium text-[#d8efff] hover:border-[#76bcec]"
            to={`/games/${encodeURIComponent(gameId)}`}
          >
            対戦結果へ戻る
          </Link>
          <AccountMenu />
        </div>
      }
    >
      <PageHeader
        description="対戦で実際に使用したカードに関連する防災情報です。災害時の行動は、自治体などの最新の公式情報を優先してください。"
        eyebrow="GAME LEARNING"
        title="この対戦から学ぶ"
      />

      <section className="py-8" aria-labelledby="used-cards-title">
        <h2
          className="text-xl font-semibold text-[#edf3f7]"
          id="used-cards-title"
        >
          関連した使用カード
        </h2>
        {learningContext.data.selectedCards.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[#91a5b4]">
            この対戦では、現在公開中の記事に関連するカードは使用されませんでした。
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {learningContext.data.selectedCards.map((card) => (
              <li
                className="border border-[#2f4a5e] bg-[#07131c]/75 px-3 py-2 text-sm text-[#c9d8e0]"
                key={card.cardDefinitionId}
              >
                {card.cardName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="border-t border-[#2a3d4b] py-8"
        aria-labelledby="recommended-articles-title"
      >
        <h2
          className="text-xl font-semibold text-[#edf3f7]"
          id="recommended-articles-title"
        >
          おすすめの記事
        </h2>
        {articles.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[#91a5b4]">
            関連する記事はまだありません。防災情報一覧から、地域に合う情報を確認してください。
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {articles.map((article) => (
              <AppPanel key={article.id}>
                <p className="text-[11px] font-medium tracking-[.16em] text-[#5798c9]">
                  {getLearnCategoryLabel(article.category)}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-[#e7eff4]">
                  <Link
                    className="underline decoration-[#527895] underline-offset-4 hover:text-[#8ec7ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
                    to={`/learn/${article.slug}`}
                  >
                    {article.title}
                  </Link>
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#a7b8c2]">
                  {article.summary}
                </p>
                <p className="mt-4 text-xs text-[#718895]">
                  関連カード:{" "}
                  {article.matchedCardDefinitionIds
                    .map(
                      (cardDefinitionId) =>
                        selectedCards.get(cardDefinitionId)?.cardName ??
                        cardDefinitionId,
                    )
                    .join("、")}
                </p>
              </AppPanel>
            ))}
          </div>
        )}
        <Link className={`mt-6 ${appButtonClassName.secondary}`} to="/learn">
          防災情報一覧を見る
        </Link>
      </section>
    </AppShell>
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
    <AppShell contentClassName="flex min-h-[calc(100dvh-76px)] items-center justify-center py-12">
      <AppEmptyState
        action={
          <Link
            className={appButtonClassName.secondary}
            to={
              gameId === undefined
                ? "/"
                : `/games/${encodeURIComponent(gameId)}`
            }
          >
            {gameId === undefined ? "対戦画面の入口へ戻る" : "対戦結果へ戻る"}
          </Link>
        }
        description="対戦の状態を確認してから、もう一度お試しください。"
        title={title}
      />
    </AppShell>
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
