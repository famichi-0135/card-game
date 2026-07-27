import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { getSafeReturnTo } from "../../app/return-to.ts";
import { useSession } from "../../app/session.ts";
import {
  AuthApiError,
  signInAnonymously,
  signOut,
  startGoogleSignIn,
} from "./auth-api.ts";
import {
  AuthLayout,
  AuthStatus,
  authPrimaryButtonClassName,
} from "./auth-layout.tsx";

export const authSessionQueryKey = ["auth", "session"] as const;

export function LoginRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingGuestSession, setIsStartingGuestSession] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const oauthError =
    searchParams.get("oauthError") === "1" || searchParams.has("error");
  const oauthErrorMessage = getOAuthErrorMessage(searchParams.get("error"));

  const isAnonymous = session.data?.isAnonymous === true;

  if (session.data !== null && session.data !== undefined && !isAnonymous) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsSubmitting(true);
    try {
      await startGoogleSignIn(returnTo);
    } catch (requestError) {
      setError(
        getAuthErrorMessage("Googleでログインできませんでした。", requestError),
      );
      setIsSubmitting(false);
    }
  }

  async function handleAnonymousSignIn() {
    setError(null);
    setIsStartingGuestSession(true);
    try {
      await signInAnonymously();
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(
        getAuthErrorMessage("ゲストとして開始できませんでした。", requestError),
      );
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
        {oauthError ? (
          <AuthStatus tone="error">{oauthErrorMessage}</AuthStatus>
        ) : null}
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
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
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    if (
      confirmBeforeLogout &&
      !window.confirm("対戦中です。ログアウトしてトップへ戻りますか？")
    ) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await signOut();
      queryClient.setQueryData(authSessionQueryKey, null);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(
        getAuthErrorMessage("ログアウトできませんでした。", requestError),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <span className="grid justify-items-end gap-1">
      <button
        className={className}
        disabled={isSubmitting}
        onClick={() => void handleClick()}
        type="button"
      >
        {isSubmitting ? "ログアウトしています" : "ログアウト"}
      </button>
      {error === null ? null : (
        <span
          className="max-w-52 text-right text-xs text-red-700"
          role="status"
        >
          {error}
        </span>
      )}
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
