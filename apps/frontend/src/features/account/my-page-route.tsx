import { Navigate, useLocation } from "react-router";
import { createAuthPath } from "../../app/return-to.ts";
import { RouteMessage } from "../../app/route-message.tsx";
import { useSession } from "../../app/session.ts";
import { MyPage } from "./my-page.tsx";

export function AuthenticatedMyPageRoute() {
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

  return <MyPage session={session.data} />;
}
