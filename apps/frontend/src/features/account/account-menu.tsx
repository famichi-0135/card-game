import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "../../app/session.ts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar.tsx";
import { Button } from "../../components/ui/button.tsx";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../components/ui/hover-card.tsx";
import {
  authSessionQueryKey,
  getAuthErrorMessage,
} from "../auth/auth-routes.tsx";
import { signOut } from "../auth/auth-api.ts";

export function AccountMenu() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.data === null || session.data === undefined) {
    return null;
  }

  const { user } = session.data;
  const accountKind = session.data.isAnonymous ? "ゲスト" : "Googleアカウント";

  async function handleSignOut() {
    setError(null);
    setIsLoggingOut(true);
    try {
      await signOut();
      queryClient.setQueryData(authSessionQueryKey, null);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(
        getAuthErrorMessage("ログアウトできませんでした。", requestError),
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Link
            aria-label="マイページ"
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/mypage"
          />
        }
      >
        <Avatar aria-hidden="true" size="lg">
          {user.image === null ? null : <AvatarImage alt="" src={user.image} />}
          <AvatarFallback>{getAvatarFallback(user.name)}</AvatarFallback>
        </Avatar>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{accountKind}</p>
          </div>
          <Button className="w-full" render={<Link to="/mypage" />}>
            マイページ
          </Button>
          <Button
            className="w-full"
            disabled={isLoggingOut}
            onClick={() => void handleSignOut()}
            variant="outline"
          >
            {isLoggingOut ? "ログアウトしています" : "ログアウト"}
          </Button>
          {error === null ? null : (
            <p className="text-xs text-destructive" role="status">
              {error}
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function getAvatarFallback(name: string): string {
  return Array.from(name.trim()).slice(0, 2).join("") || "?";
}
