import {
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router";
import { createAuthPath } from "../../app/return-to.ts";
import { RouteMessage } from "../../app/route-message.tsx";
import { useSession } from "../../app/session.ts";
import {
  FIXTURE_GAME_ID,
  createGameBoardFixture,
} from "./fixtures/game-board-fixture.ts";
import { FixtureGameBoard, GameBoard } from "./game-board.tsx";

export function GameRoute() {
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

  return <GameBoard gameId={gameId} />;
}
