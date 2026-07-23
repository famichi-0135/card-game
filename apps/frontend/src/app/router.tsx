import {
  createBrowserRouter,
  Link,
  useParams,
  useRouteError,
} from "react-router";
import { GameBoard } from "../features/game-board/game-board.tsx";
import {
  FIXTURE_GAME_ID,
  createGameBoardFixture,
} from "../features/game-board/fixtures/game-board-fixture.ts";
import { useSession } from "./session.ts";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomeRoute,
  },
  {
    path: "/games/:gameId",
    Component: GameRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "*",
    Component: NotFoundRoute,
  },
]);

function HomeRoute() {
  return (
    <main className="route-message">
      <p className="route-message__eyebrow">DISASTAR CARD GAME</p>
      <h1>対戦画面</h1>
      <p>盤面の静的プレビューを確認できます。</p>
      <Link className="route-message__link" to={`/games/${FIXTURE_GAME_ID}`}>
        デモ盤面を開く
      </Link>
    </main>
  );
}

function GameRoute() {
  const { gameId } = useParams();
  if (gameId === undefined) {
    throw new Error("ゲームIDが指定されていません。");
  }

  if (gameId === FIXTURE_GAME_ID) {
    return <GameBoard fixture={createGameBoardFixture(gameId)} />;
  }

  return <AuthenticatedGameRoute />;
}

function AuthenticatedGameRoute() {
  const session = useSession();

  if (session.isPending) {
    return <RouteMessage title="認証状態を確認しています" />;
  }
  if (session.isError) {
    return <RouteMessage title="認証状態を確認できませんでした" />;
  }
  if (session.data === null) {
    return <RouteMessage title="対戦にはログインが必要です" />;
  }

  return <RouteMessage title="対戦データを接続しています" />;
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const description =
    error instanceof Error ? error.message : "予期しないエラーです。";
  return (
    <RouteMessage
      title="対戦画面を表示できませんでした"
      description={description}
    />
  );
}

function NotFoundRoute() {
  return <RouteMessage title="ページが見つかりません" />;
}

function RouteMessage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <main className="route-message">
      <p className="route-message__eyebrow">DISASTAR CARD GAME</p>
      <h1>{title}</h1>
      {description === undefined ? null : <p>{description}</p>}
      <Link className="route-message__link" to="/">
        対戦画面の入口へ戻る
      </Link>
    </main>
  );
}
