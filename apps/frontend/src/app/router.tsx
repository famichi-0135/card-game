import {
  createBrowserRouter,
  Navigate,
  useRouteError,
  useSearchParams,
} from "react-router";
import { createLazyRoute } from "./route-lazy.tsx";
import { RouteMessage } from "./route-message.tsx";
import { getRouteErrorDescription } from "./route-error.ts";
import { createAuthPath, getSafeReturnTo } from "./return-to.ts";

const MatchmakingHomeRoute = createLazyRoute(
  () => import("../features/matchmaking/lobby-home.tsx"),
  "MatchmakingHomeRoute",
);
const LearnIndexRoute = createLazyRoute(
  () => import("../features/learn/learn-routes.tsx"),
  "LearnIndexRoute",
);
const LearnArticleRoute = createLazyRoute(
  () => import("../features/learn/learn-routes.tsx"),
  "LearnArticleRoute",
);
const RuleGuideRoute = createLazyRoute(
  () => import("../features/rule/rule-guide-route.tsx"),
  "RuleGuideRoute",
);
const AuthenticatedMyPageRoute = createLazyRoute(
  () => import("../features/account/my-page-route.tsx"),
  "AuthenticatedMyPageRoute",
);
const RoomRoute = createLazyRoute(
  () => import("../features/matchmaking/match-room-route.tsx"),
  "RoomRoute",
);
const GameLearningRoute = createLazyRoute(
  () => import("../features/game-learning/game-learning-route.tsx"),
  "GameLearningRoute",
);
const GameRoute = createLazyRoute(
  () => import("../features/game-board/game-route.tsx"),
  "GameRoute",
);
const LoginRoute = createLazyRoute(
  () => import("../features/auth/auth-routes.tsx"),
  "LoginRoute",
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MatchmakingHomeRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/learn",
    Component: LearnIndexRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/learn/:slug",
    Component: LearnArticleRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/rule",
    Component: RuleGuideRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/mypage",
    Component: AuthenticatedMyPageRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/rooms/:matchId",
    Component: RoomRoute,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: "/games/:gameId/learn",
    Component: GameLearningRoute,
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
    ErrorBoundary: RouteErrorBoundary,
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

function RouteErrorBoundary() {
  const error = useRouteError();
  const description = getRouteErrorDescription(error);
  return (
    <RouteMessage
      title="ページを表示できませんでした"
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
