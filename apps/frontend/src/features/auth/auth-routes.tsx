import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { getSafeReturnTo } from "../../app/return-to.ts";
import { useSession } from "../../app/session.ts";
import {
  AuthApiError,
  signInAnonymously,
  signOut,
  startGoogleSignIn,
} from "./auth-api.ts";
import { AuthLayout, authPrimaryButtonClassName } from "./auth-layout.tsx";
import { toast } from "../../components/ui/toast.tsx";
import { appButtonClassName } from "../../components/application-ui.tsx";

export const authSessionQueryKey = ["auth", "session"] as const;

export function LoginRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingGuestSession, setIsStartingGuestSession] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const oauthError =
    searchParams.get("oauthError") === "1" || searchParams.has("error");
  const oauthErrorMessage = getOAuthErrorMessage(searchParams.get("error"));
  const hasNotifiedOAuthError = useRef(false);

  const isAnonymous = session.data?.isAnonymous === true;

  useEffect(() => {
    if (!oauthError || hasNotifiedOAuthError.current) {
      return;
    }

    hasNotifiedOAuthError.current = true;

    toast.add({
      description: oauthErrorMessage,
      title: "Googleでログインできません",
      type: "error",
    });
  }, [oauthError, oauthErrorMessage]);

  if (session.data !== null && session.data !== undefined && !isAnonymous) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    try {
      await startGoogleSignIn(returnTo);
    } catch (requestError) {
      toast.add({
        description: getAuthErrorMessage(
          "Googleでログインできませんでした。",
          requestError,
        ),
        title: "Googleでログインできません",
        type: "error",
      });
      setIsSubmitting(false);
    }
  }

  async function handleAnonymousSignIn() {
    setIsStartingGuestSession(true);
    try {
      await signInAnonymously();
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      toast.add({
        description: getAuthErrorMessage(
          "ゲストとして開始できませんでした。",
          requestError,
        ),
        title: "ゲストとして開始できません",
        type: "error",
      });
    } finally {
      setIsStartingGuestSession(false);
    }
  }

  return (
    <AuthLayout
      title={isAnonymous ? "アカウントを引き継ぐ" : "ログイン"}
      description={
        isAnonymous
          ? "Googleアカウントへゲームの進行状況を引き継ぎます。"
          : "Googleアカウントでログインして対戦を始めます。"
      }
    >
      <div className="grid gap-4">
        <button
          className={authPrimaryButtonClassName}
          disabled={isSubmitting || isStartingGuestSession}
          onClick={() => void handleGoogleSignIn()}
          type="button"
        >
          {isSubmitting
            ? "Googleへ移動しています"
            : isAnonymous
              ? "Googleアカウントに引き継ぐ"
              : "Googleでログイン"}
        </button>
        {isAnonymous ? null : (
          <button
            className={appButtonClassName.secondary}
            disabled={isSubmitting || isStartingGuestSession}
            onClick={() => void handleAnonymousSignIn()}
            type="button"
          >
            {isStartingGuestSession ? "準備しています" : "ゲストとして始める"}
          </button>
        )}
      </div>
    </AuthLayout>
  );
}

export function LogoutButton({
  confirmBeforeLogout = false,
  className,
}: {
  confirmBeforeLogout?: boolean;
  className: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    if (
      confirmBeforeLogout &&
      !window.confirm("対戦中です。ログアウトしてトップへ戻りますか？")
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signOut();
      queryClient.setQueryData(authSessionQueryKey, null);
      navigate("/", { replace: true });
    } catch (requestError) {
      toast.add({
        description: getAuthErrorMessage(
          "ログアウトできませんでした。",
          requestError,
        ),
        title: "ログアウトできません",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <span className="inline-flex">
      <button
        className={className}
        disabled={isSubmitting}
        onClick={() => void handleClick()}
        type="button"
      >
        {isSubmitting ? "ログアウトしています" : "ログアウト"}
      </button>
    </span>
  );
}

export function getAuthErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof AuthApiError && error.status === 429) {
    return "短時間に多くの操作が行われました。時間をおいて再試行してください。";
  }

  return `${prefix}接続状態を確認して、もう一度お試しください。`;
}

function getOAuthErrorMessage(errorCode: string | null): string {
  if (errorCode === "ACCOUNT_LINK_CONFLICT") {
    return "このGoogleアカウントには別のゲームデータが保存されているため、ゲストデータを引き継げません。ゲストとして続けるか、別のGoogleアカウントを選択してください。";
  }

  return "Googleでのログインを完了できませんでした。もう一度お試しください。";
}
