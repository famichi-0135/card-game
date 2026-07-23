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
import {
  ForgotPasswordRoute,
  LoginRoute,
  LogoutButton,
  RegisterRoute,
  ResetPasswordRoute,
  VerifyEmailRoute,
} from "../features/auth/auth-routes.tsx";
import { createAuthPath } from "./return-to.ts";
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
    path: "/login",
    Component: LoginRoute,
  },
  {
    path: "/register",
    Component: RegisterRoute,
  },
  {
    path: "/verify-email",
    Component: VerifyEmailRoute,
  },
  {
    path: "/forgot-password",
    Component: ForgotPasswordRoute,
  },
  {
    path: "/reset-password",
    Component: ResetPasswordRoute,
  },
  {
    path: "*",
    Component: NotFoundRoute,
  },
]);

function HomeRoute() {
  const session = useSession();

  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 border-b border-slate-300 py-4">
        <p className="text-sm font-semibold text-slate-700">
          DISASTAR CARD GAME
        </p>
        <div className="flex items-center gap-3">
          {session.data === null ? (
            <>
              <Link
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                to="/login"
              >
                ログイン
              </Link>
              <Link
                className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                to="/register"
              >
                登録
              </Link>
            </>
          ) : session.data === undefined ? null : (
            <LogoutButton className="rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900" />
          )}
        </div>
      </div>
      <section className="mx-auto grid w-full max-w-5xl gap-4 py-16">
        <p className="text-sm font-medium text-slate-600">対戦準備</p>
        <h1 className="text-3xl font-semibold">対戦画面</h1>
        <p className="max-w-xl leading-7 text-slate-600">
          対戦の作成・参加は次の実装スコープで追加します。現在は盤面表示と操作を確認できます。
        </p>
        <div>
          <Link
            className="inline-flex rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to={`/games/${FIXTURE_GAME_ID}`}
          >
            デモ盤面を開く
          </Link>
        </div>
      </section>
    </main>
  );
}

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
