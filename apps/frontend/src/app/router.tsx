import {
  createBrowserRouter,
  Link,
  Navigate,
  useLocation,
  useParams,
  useRouteError,
  useSearchParams,
} from "react-router";
import {
  FixtureGameBoard,
  GameBoard,
} from "../features/game-board/game-board.tsx";
import {
  FIXTURE_GAME_ID,
  createGameBoardFixture,
} from "../features/game-board/fixtures/game-board-fixture.ts";
import { LoginRoute, LogoutButton } from "../features/auth/auth-routes.tsx";
import {
  LearnArticleRoute,
  LearnIndexRoute,
} from "../features/learn/learn-routes.tsx";
import { MatchmakingHomeRoute } from "../features/matchmaking/lobby-home.tsx";
import { MatchRoom } from "../features/matchmaking/match-room.tsx";
import { createAuthPath, getSafeReturnTo } from "./return-to.ts";
import { useSession } from "./session.ts";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MatchmakingHomeRoute,
  },
  {
    path: "/learn",
    Component: LearnIndexRoute,
  },
  {
    path: "/learn/:slug",
    Component: LearnArticleRoute,
  },
  {
    path: "/rooms/:matchId",
    Component: RoomRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/games/:gameId",
    Component: GameRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/login",
    Component: LoginRoute,
  },
  {
    path: "/register",
    Component: LegacyAuthRoute,
  },
  {
    path: "/verify-email",
    Component: LegacyAuthRoute,
  },
  {
    path: "/forgot-password",
    Component: LegacyAuthRoute,
  },
  {
    path: "/reset-password",
    Component: LegacyAuthRoute,
  },
  {
    path: "*",
    Component: NotFoundRoute,
  },
]);

function GameRoute() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  if (gameId === undefined) {
    throw new Error("ゲームIDが指定されていません。");
  }

  if (gameId === FIXTURE_GAME_ID) {
    const requestedScenario = searchParams.get("scenario");
    const scenario =
      requestedScenario === "support" || requestedScenario === "finished"
        ? requestedScenario
        : "placement";
    return (
      <FixtureGameBoard fixture={createGameBoardFixture(gameId, scenario)} />
    );
  }

  return <AuthenticatedGameRoute gameId={gameId} />;
}

function RoomRoute() {
  const { matchId } = useParams();
  if (matchId === undefined) {
    throw new Error("招待部屋 ID が指定されていません。");
  }

  return <AuthenticatedRoomRoute matchId={matchId} />;
}

function AuthenticatedGameRoute({ gameId }: { gameId: string }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return <RouteMessage title="認証状態を確認しています" />;
  }
  if (session.isError) {
    return <RouteMessage title="認証状態を確認できませんでした" />;
  }
  if (session.data === null) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate replace to={createAuthPath("/login", returnTo)} />;
  }

  return (
    <GameBoard
      accountAction={
        <LogoutButton
          className="shrink-0 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          confirmBeforeLogout
        />
      }
      gameId={gameId}
    />
  );
}

function AuthenticatedRoomRoute({ matchId }: { matchId: string }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return <RouteMessage title="認証状態を確認しています" />;
  }
  if (session.isError) {
    return <RouteMessage title="認証状態を確認できませんでした" />;
  }
  if (session.data === null) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate replace to={createAuthPath("/login", returnTo)} />;
  }

  return <MatchRoom matchId={matchId} playerId={session.data.user.id} />;
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

function LegacyAuthRoute() {
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  return <Navigate replace to={createAuthPath("/login", returnTo)} />;
}

function RouteMessage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">
          DISASTAR CARD GAME
        </p>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        {description === undefined ? null : (
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        )}
        <Link
          className="mt-6 inline-flex rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          to="/"
        >
          対戦画面の入口へ戻る
        </Link>
      </section>
    </main>
  );
}
