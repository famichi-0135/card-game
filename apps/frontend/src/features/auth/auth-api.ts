export class AuthApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Authentication request failed: ${status}`);
    this.name = "AuthApiError";
    this.status = status;
  }
}

type GoogleSignInResponse = {
  url?: string;
};

export async function startGoogleSignIn(returnTo: string): Promise<void> {
  const callbackURL = new URL(returnTo, window.location.origin).toString();
  const errorCallbackURL = new URL("/login", window.location.origin);
  errorCallbackURL.searchParams.set("oauthError", "1");
  if (returnTo !== "/") {
    errorCallbackURL.searchParams.set("returnTo", returnTo);
  }
  const response = await postAuth<GoogleSignInResponse>("/sign-in/social", {
    provider: "google",
    callbackURL,
    errorCallbackURL: errorCallbackURL.toString(),
    disableRedirect: true,
  });

  if (typeof response.url !== "string") {
    throw new Error("Google OAuthの認可URLが返されませんでした。");
  }

  window.location.assign(response.url);
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
