export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const response = await env.BACKEND.fetch(request);
      const accountLinkConflictRedirect = await getAccountLinkConflictRedirect(
        url,
        response,
      );
      if (accountLinkConflictRedirect !== null) {
        return Response.redirect(accountLinkConflictRedirect, 302);
      }
      return response;
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function getAccountLinkConflictRedirect(
  url: URL,
  response: Response,
): Promise<string | null> {
  if (url.pathname !== "/api/auth/callback/google") {
    return null;
  }

  if (response.status === 409) {
    try {
      const payload = (await response.clone().json()) as { code?: unknown };
      if (payload.code === "ACCOUNT_LINK_CONFLICT") {
        return createAccountLinkConflictRedirect(url);
      }
    } catch {
      return null;
    }
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location === null) {
      return null;
    }

    const redirect = new URL(location, url.origin);
    if (
      redirect.origin === url.origin &&
      redirect.pathname === "/login" &&
      redirect.searchParams.get("error") === "ACCOUNT_LINK_CONFLICT"
    ) {
      return createAccountLinkConflictRedirect(url);
    }
  }

  return null;
}

function createAccountLinkConflictRedirect(url: URL): string {
  return new URL(
    "/login?oauthError=1&error=ACCOUNT_LINK_CONFLICT",
    url.origin,
  ).toString();
}
