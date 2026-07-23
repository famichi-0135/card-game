export class AuthApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Authentication request failed: ${status}`);
    this.name = "AuthApiError";
    this.status = status;
  }
}

type AuthUser = {
  id: string;
  name?: string | null;
};

type SignInResponse = {
  user: AuthUser;
};

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  returnTo: string;
};

export async function signInWithEmail({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<SignInResponse> {
  return await postAuth<SignInResponse>("/sign-in/email", { email, password });
}

export async function signUpWithEmail({
  name,
  email,
  password,
  returnTo,
}: SignUpInput): Promise<void> {
  await postAuth("/sign-up/email", {
    name,
    email,
    password,
    callbackURL: createFrontendURL("/verify-email", {
      returnTo,
      verified: "1",
    }),
  });
}

export async function resendVerificationEmail({
  email,
  returnTo,
}: {
  email: string;
  returnTo: string;
}): Promise<void> {
  await postAuth("/send-verification-email", {
    email,
    callbackURL: createFrontendURL("/verify-email", {
      returnTo,
      verified: "1",
    }),
  });
}

export async function requestPasswordReset({
  email,
  returnTo,
}: {
  email: string;
  returnTo: string;
}): Promise<void> {
  await postAuth("/request-password-reset", {
    email,
    redirectTo: createFrontendURL("/reset-password", { returnTo }),
  });
}

export async function resetPassword({
  token,
  password,
}: {
  token: string;
  password: string;
}): Promise<void> {
  await postAuth("/reset-password", { token, newPassword: password });
}

export async function signOut(): Promise<void> {
  await postAuth("/sign-out", {});
}

async function postAuth<T = unknown>(path: string, body: object): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new AuthApiError(response.status);
  }

  return (await response.json()) as T;
}

function createFrontendURL(
  path: string,
  values: Record<string, string>,
): string {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(values)) {
    if (value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
