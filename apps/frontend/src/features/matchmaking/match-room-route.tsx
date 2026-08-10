import { Navigate, useLocation, useParams } from "react-router";
import { createAuthPath } from "../../app/return-to.ts";
import { RouteMessage } from "../../app/route-message.tsx";
import { useSession } from "../../app/session.ts";
import { MatchRoom } from "./match-room.tsx";

export function RoomRoute() {
  const { matchId } = useParams();
  if (matchId === undefined) {
    throw new Error("招待部屋 ID が指定されていません。");
  }

  return <AuthenticatedRoomRoute matchId={matchId} />;
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

  return <MatchRoom matchId={matchId} playerId={session.data.playerId} />;
}
