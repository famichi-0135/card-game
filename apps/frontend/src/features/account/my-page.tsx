import { useQueryClient } from "@tanstack/react-query";
import type { AuthenticatedSessionResponse } from "@disastar/contracts/session";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  AppPanel,
  AppShell,
  PageHeader,
  appButtonClassName,
} from "../../components/application-ui.tsx";
import { toast } from "../../components/ui/toast.tsx";
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
import { AuthApiError, deleteAccount } from "../auth/auth-api.ts";
import {
  authSessionQueryKey,
  getAuthErrorMessage,
  LogoutButton,
} from "../auth/auth-routes.tsx";

export function MyPage({ session }: { session: AuthenticatedSessionResponse }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await deleteAccount();
      queryClient.setQueryData(authSessionQueryKey, null);
      navigate("/", { replace: true });
    } catch (error) {
      toast.add({
        description: getDeleteAccountErrorMessage(error),
        title: "アカウントを削除できません",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const accountKind = session.isAnonymous ? "ゲスト" : "Googleアカウント";
  const deleteLabel = session.isAnonymous
    ? "ゲストデータを削除"
    : "アカウントを削除";

  return (
    <AppShell contentClassName="max-w-3xl">
      <div className="flex flex-col gap-5">
        <PageHeader
          description="アカウントの状態と、この端末での利用設定を確認できます。"
          eyebrow="PLAYER ACCOUNT"
          title="マイページ"
        />

        <AppPanel label="ACCOUNT">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {session.user.image === null ? null : (
                <AvatarImage alt="" src={session.user.image} />
              )}
              <AvatarFallback>
                {getAvatarFallback(session.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm text-[#91a5b4]">{accountKind}で利用中</p>
              <p className="mt-1 truncate text-lg font-semibold text-[#e9f1f5]">
                {session.user.name}
              </p>
            </div>
          </div>
        </AppPanel>

        {session.isAnonymous ? (
          <AppPanel label="ACCOUNT TRANSFER">
            <h2 className="text-lg font-semibold text-[#e7eff4]">
              Googleアカウントへの引継ぎ
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#91a5b4]">
              現在の対戦データをGoogleアカウントへ引き継げます。
            </p>
            <Link
              className={`mt-5 ${appButtonClassName.primary}`}
              to={createAuthPath("/login", "/mypage")}
            >
              Googleアカウントに引き継ぐ
            </Link>
          </AppPanel>
        ) : null}

        {session.isAnonymous ? null : (
          <AppPanel label="SESSION">
            <h2 className="text-lg font-semibold text-[#e7eff4]">ログアウト</h2>
            <p className="mt-2 text-sm leading-6 text-[#91a5b4]">
              この端末でのGoogleアカウントのログインを終了します。
            </p>
            <div className="mt-5">
              <LogoutButton className={appButtonClassName.tertiary} />
            </div>
          </AppPanel>
        )}

        <AppPanel label="DANGER ZONE" className="border-[#57343a]">
          <h2 className="text-lg font-semibold text-[#ffd9da]">
            アカウントの削除
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#bda9ac]">
            認証情報とログインセッションを完全に削除します。対戦記録は参加者や再接続の整合性のため保持されますが、削除後のアカウントから参照できません。
          </p>
          <div className="mt-5">
            <AlertDialog>
              <AlertDialogTrigger
                render={<button className={appButtonClassName.danger} />}
              >
                {deleteLabel}
              </AlertDialogTrigger>
              <AlertDialogContent className="border border-[#3a5160] bg-[linear-gradient(145deg,#0d1d28,#050d13)] text-[#edf5f9] shadow-[0_24px_64px_rgba(0,0,0,.65)]">
                <AlertDialogHeader className="text-left sm:place-items-start sm:text-left">
                  <AlertDialogTitle>{deleteLabel}しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。認証情報とすべてのログインセッションを削除します。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="border-[#2a3d4b] bg-[#071018]/90">
                  <AlertDialogCancel
                    className={appButtonClassName.tertiary}
                    disabled={isDeleting}
                  >
                    キャンセル
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isDeleting}
                    onClick={() => void handleDeleteAccount()}
                    className={appButtonClassName.danger}
                  >
                    {isDeleting ? "削除しています" : deleteLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </AppPanel>
      </div>
    </AppShell>
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
