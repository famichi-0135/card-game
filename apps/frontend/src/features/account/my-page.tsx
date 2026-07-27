import { useQueryClient } from "@tanstack/react-query";
import type { AuthenticatedSessionResponse } from "@disastar/contracts/session";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { createAuthPath } from "../../app/return-to.ts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog.tsx";
import { Button } from "../../components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx";
import { AccountMenu } from "./account-menu.tsx";
import { AuthApiError, deleteAccount } from "../auth/auth-api.ts";
import {
  authSessionQueryKey,
  getAuthErrorMessage,
} from "../auth/auth-routes.tsx";

export function MyPage({ session }: { session: AuthenticatedSessionResponse }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteAccount();
      queryClient.setQueryData(authSessionQueryKey, null);
      navigate("/", { replace: true });
    } catch (error) {
      setDeleteError(getDeleteAccountErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  const accountKind = session.isAnonymous ? "ゲスト" : "Googleアカウント";
  const deleteLabel = session.isAnonymous
    ? "ゲストデータを削除"
    : "アカウントを削除";

  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-300 py-4">
          <Link
            className="text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/"
          >
            DISASTAR CARD GAME
          </Link>
          <AccountMenu />
        </header>

        <div className="flex flex-col gap-6 py-10">
          <div>
            <h1 className="text-2xl font-semibold">マイページ</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              アカウントの状態を確認できます。
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>アカウント</CardTitle>
              <CardDescription>{accountKind}で利用中です。</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Avatar size="lg">
                {session.user.image === null ? null : (
                  <AvatarImage alt="" src={session.user.image} />
                )}
                <AvatarFallback>
                  {getAvatarFallback(session.user.name)}
                </AvatarFallback>
              </Avatar>
              <p className="min-w-0 truncate font-medium">
                {session.user.name}
              </p>
            </CardContent>
          </Card>

          {session.isAnonymous ? (
            <Card>
              <CardHeader>
                <CardTitle>Googleアカウントへの引継ぎ</CardTitle>
                <CardDescription>
                  現在の対戦データをGoogleアカウントへ引き継げます。
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  render={<Link to={createAuthPath("/login", "/mypage")} />}
                >
                  Googleアカウントに引き継ぐ
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>アカウントの削除</CardTitle>
              <CardDescription>
                認証情報とログインセッションを完全に削除します。対戦記録は参加者や再接続の整合性のため保持されますが、削除後のアカウントから参照できません。
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-3">
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="destructive" />}>
                  {deleteLabel}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{deleteLabel}しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作は取り消せません。認証情報とすべてのログインセッションを削除します。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      キャンセル
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isDeleting}
                      onClick={() => void handleDeleteAccount()}
                      variant="destructive"
                    >
                      {isDeleting ? "削除しています" : deleteLabel}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {deleteError === null ? null : (
                <p className="text-sm text-destructive" role="status">
                  {deleteError}
                </p>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}

function getAvatarFallback(name: string): string {
  return Array.from(name.trim()).slice(0, 2).join("") || "?";
}

function getDeleteAccountErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError && error.status === 400) {
    return "安全のため、ログアウトしてGoogleで再ログインしてから削除してください。";
  }

  return getAuthErrorMessage("アカウントを削除できませんでした。", error);
}
