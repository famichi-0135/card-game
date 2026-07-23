import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { getSafeReturnTo } from "../../app/return-to.ts";
import { useSession } from "../../app/session.ts";
import { AuthApiError, signOut, startGoogleSignIn } from "./auth-api.ts";
import {
  AuthLayout,
  AuthStatus,
  authPrimaryButtonClassName,
} from "./auth-layout.tsx";

const sessionQueryKey = ["auth", "session"] as const;

export function LoginRoute() {
  const [searchParams] = useSearchParams();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const oauthError =
    searchParams.get("oauthError") === "1" || searchParams.has("error");

  if (session.data !== null && session.data !== undefined) {
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

  return (
    <AuthLayout
      title="ログイン"
      description="Googleアカウントでログインして対戦を始めます。"
    >
      <div className="grid gap-4">
        {oauthError ? (
          <AuthStatus tone="error">
            Googleでのログインを完了できませんでした。もう一度お試しください。
          </AuthStatus>
        ) : null}
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <button
          className={authPrimaryButtonClassName}
          disabled={isSubmitting}
          onClick={() => void handleGoogleSignIn()}
          type="button"
        >
          {isSubmitting ? "Googleへ移動しています" : "Googleでログイン"}
        </button>
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
      queryClient.setQueryData(sessionQueryKey, null);
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

function getAuthErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof AuthApiError && error.status === 429) {
    return "短時間に多くの操作が行われました。時間をおいて再試行してください。";
  }

  return `${prefix}接続状態を確認して、もう一度お試しください。`;
}
