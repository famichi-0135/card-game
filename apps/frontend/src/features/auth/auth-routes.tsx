import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { createAuthPath, getSafeReturnTo } from "../../app/return-to.ts";
import { useSession } from "../../app/session.ts";
import {
  AuthApiError,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from "./auth-api.ts";
import {
  AuthField,
  AuthLayout,
  AuthStatus,
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from "./auth-layout.tsx";

const sessionQueryKey = ["auth", "session"] as const;
const minimumPasswordLength = 12;

export function LoginRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const passwordWasReset = searchParams.get("passwordReset") === "1";

  if (session.data !== null && session.data !== undefined) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = getRequiredTextValue(formData, "email");
    const password = getRequiredFormValue(formData, "password");

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await signInWithEmail({ email, password });
      queryClient.setQueryData(sessionQueryKey, { user: response.user });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage("ログインできませんでした。", requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="ログイン"
      description="対戦を続けるにはログインしてください。"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {passwordWasReset ? (
          <AuthStatus tone="success">
            パスワードを再設定しました。新しいパスワードでログインしてください。
          </AuthStatus>
        ) : null}
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <AuthField label="メールアドレス">
          <input
            autoComplete="email"
            className={authInputClassName}
            name="email"
            required
            type="email"
          />
        </AuthField>
        <AuthField label="パスワード">
          <input
            autoComplete="current-password"
            className={authInputClassName}
            name="password"
            required
            type="password"
          />
        </AuthField>
        <button
          className={authPrimaryButtonClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "ログインしています" : "ログイン"}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
        <Link
          className={authLinkClassName}
          to={createAuthPath("/register", returnTo)}
        >
          アカウントを登録する
        </Link>
        <Link
          className={authLinkClassName}
          to={createAuthPath("/forgot-password", returnTo)}
        >
          パスワードを忘れた場合
        </Link>
      </div>
    </AuthLayout>
  );
}

export function RegisterRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  if (session.data !== null && session.data !== undefined) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = getRequiredTextValue(formData, "name");
    const email = getRequiredTextValue(formData, "email");
    const password = getRequiredFormValue(formData, "password");
    const passwordConfirmation = getRequiredFormValue(
      formData,
      "passwordConfirmation",
    );

    if (password !== passwordConfirmation) {
      setError("パスワードが一致しません。");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await signUpWithEmail({ name, email, password, returnTo });
      const verifyEmailParams = new URLSearchParams({ email });
      if (returnTo !== "/") {
        verifyEmailParams.set("returnTo", returnTo);
      }
      navigate(`/verify-email?${verifyEmailParams.toString()}`, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        getAuthErrorMessage("アカウントを登録できませんでした。", requestError),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="アカウント登録"
      description="登録後、メールアドレスの確認を完了するとログインできます。"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <AuthField label="表示名">
          <input
            autoComplete="name"
            className={authInputClassName}
            maxLength={128}
            name="name"
            required
            type="text"
          />
        </AuthField>
        <AuthField label="メールアドレス">
          <input
            autoComplete="email"
            className={authInputClassName}
            name="email"
            required
            type="email"
          />
        </AuthField>
        <AuthField label={`パスワード（${minimumPasswordLength}文字以上）`}>
          <input
            autoComplete="new-password"
            className={authInputClassName}
            minLength={minimumPasswordLength}
            name="password"
            required
            type="password"
          />
        </AuthField>
        <AuthField label="パスワード（確認）">
          <input
            autoComplete="new-password"
            className={authInputClassName}
            minLength={minimumPasswordLength}
            name="passwordConfirmation"
            required
            type="password"
          />
        </AuthField>
        <button
          className={authPrimaryButtonClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "登録しています" : "登録する"}
        </button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        すでにアカウントをお持ちの場合は、{" "}
        <Link
          className={authLinkClassName}
          to={createAuthPath("/login", returnTo)}
        >
          ログイン
        </Link>
      </p>
    </AuthLayout>
  );
}

export function VerifyEmailRoute() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendComplete, setIsResendComplete] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const wasVerified = searchParams.get("verified") === "1";
  const verificationFailed = searchParams.get("error") !== null;

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const requestedEmail = getRequiredTextValue(formData, "email");

    setEmail(requestedEmail);
    setError(null);
    setIsResendComplete(false);
    setIsSubmitting(true);
    try {
      await resendVerificationEmail({ email: requestedEmail, returnTo });
      setIsResendComplete(true);
    } catch (requestError) {
      setError(
        getAuthErrorMessage("確認メールを送信できませんでした。", requestError),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="メールアドレスの確認"
      description={
        verificationFailed
          ? "確認リンクが無効か、期限切れです。確認メールを再送してください。"
          : wasVerified
            ? "メールアドレスの確認が完了しました。ログインしてください。"
            : "確認メールを送信しました。メール内のリンクを開いた後、ログインしてください。"
      }
    >
      <div className="grid gap-5">
        {verificationFailed ? (
          <AuthStatus tone="error">
            確認を完了できませんでした。新しい確認メールを送信してください。
          </AuthStatus>
        ) : null}
        {isResendComplete ? (
          <AuthStatus tone="success">
            入力されたメールアドレスに確認メールを送信しました。
          </AuthStatus>
        ) : null}
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <Link
          className={authPrimaryButtonClassName}
          to={createAuthPath("/login", returnTo)}
        >
          ログインへ進む
        </Link>
        {wasVerified ? null : (
          <form
            className="grid gap-3 border-t border-slate-200 pt-5"
            onSubmit={(event) => void handleResend(event)}
          >
            <p className="text-sm font-medium text-slate-800">
              確認メールを再送する
            </p>
            <AuthField label="メールアドレス">
              <input
                autoComplete="email"
                className={authInputClassName}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </AuthField>
            <button
              className="h-10 rounded border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "送信しています" : "確認メールを再送"}
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

export function ForgotPasswordRoute() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = getRequiredTextValue(formData, "email");

    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email, returnTo });
      setIsComplete(true);
    } catch (requestError) {
      setError(
        getAuthErrorMessage(
          "再設定メールを送信できませんでした。",
          requestError,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="パスワードを再設定"
      description="登録済みのメールアドレスを入力してください。"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {isComplete ? (
          <AuthStatus tone="success">
            入力されたメールアドレスに、パスワード再設定の案内を送信しました。
          </AuthStatus>
        ) : null}
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <AuthField label="メールアドレス">
          <input
            autoComplete="email"
            className={authInputClassName}
            name="email"
            required
            type="email"
          />
        </AuthField>
        <button
          className={authPrimaryButtonClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "送信しています" : "再設定メールを送信"}
        </button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        <Link
          className={authLinkClassName}
          to={createAuthPath("/login", returnTo)}
        >
          ログインへ戻る
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get("token");
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token === null) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = getRequiredFormValue(formData, "password");
    const passwordConfirmation = getRequiredFormValue(
      formData,
      "passwordConfirmation",
    );

    if (password !== passwordConfirmation) {
      setError("パスワードが一致しません。");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      const loginParams = new URLSearchParams({ passwordReset: "1" });
      if (returnTo !== "/") {
        loginParams.set("returnTo", returnTo);
      }
      navigate(`/login?${loginParams.toString()}`, { replace: true });
    } catch (requestError) {
      setError(
        getAuthErrorMessage(
          "パスワードを再設定できませんでした。",
          requestError,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (token === null) {
    return (
      <AuthLayout
        title="パスワードを再設定"
        description="再設定リンクが無効か、期限切れです。新しいリンクを発行してください。"
      >
        <Link
          className={authPrimaryButtonClassName}
          to={createAuthPath("/forgot-password", returnTo)}
        >
          再設定メールを送信する
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="新しいパスワードを設定"
      description="新しいパスワードを入力してください。"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <AuthField
          label={`新しいパスワード（${minimumPasswordLength}文字以上）`}
        >
          <input
            autoComplete="new-password"
            className={authInputClassName}
            minLength={minimumPasswordLength}
            name="password"
            required
            type="password"
          />
        </AuthField>
        <AuthField label="新しいパスワード（確認）">
          <input
            autoComplete="new-password"
            className={authInputClassName}
            minLength={minimumPasswordLength}
            name="passwordConfirmation"
            required
            type="password"
          />
        </AuthField>
        <button
          className={authPrimaryButtonClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "再設定しています" : "パスワードを再設定"}
        </button>
      </form>
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

function getRequiredFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getRequiredTextValue(formData: FormData, name: string): string {
  return getRequiredFormValue(formData, name).trim();
}

function getAuthErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof AuthApiError && error.status === 429) {
    return "短時間に多くの操作が行われました。時間をおいて再試行してください。";
  }

  return `${prefix}入力内容と接続状態を確認して、もう一度お試しください。`;
}
