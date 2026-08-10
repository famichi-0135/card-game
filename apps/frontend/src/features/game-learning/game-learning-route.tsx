import { Navigate, useLocation, useParams } from "react-router";
import { createAuthPath } from "../../app/return-to.ts";
import { RouteMessage } from "../../app/route-message.tsx";
import { useSession } from "../../app/session.ts";
import { GameLearningPage } from "./game-learning-page.tsx";

export function GameLearningRoute() {
  const { gameId } = useParams();
  if (gameId === undefined) {
    throw new Error("ゲームIDが指定されていません。");
  }

  return <AuthenticatedGameLearningRoute gameId={gameId} />;
}

function AuthenticatedGameLearningRoute({ gameId }: { gameId: string }) {
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

  return <GameLearningPage gameId={gameId} />;
}
