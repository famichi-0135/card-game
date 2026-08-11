export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(GAME_ASSET_PATH_PREFIX)) {
      return serveGameAsset(request, env.GAME_ASSETS, url.pathname);
    }

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

const GAME_ASSET_PATH_PREFIX = "/game-assets/";
const GAME_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const ALLOWED_GAME_ASSET_NAMESPACES = new Set([
  "backgrounds",
  "cards",
  "portraits",
  "ui",
]);
const ALLOWED_GAME_ASSET_CONTENT_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_GAME_ASSET_EXTENSION = /\.(?:avif|jpe?g|png|webp)$/i;

async function serveGameAsset(
  request: Request,
  bucket: R2Bucket,
  pathname: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      headers: { allow: "GET, HEAD" },
      status: 405,
    });
  }

  const key = parseGameAssetKey(pathname);
  if (key === null) {
    return new Response("Bad Request", { status: 400 });
  }

  const object =
    request.method === "HEAD"
      ? await bucket.head(key)
      : await bucket.get(key, { onlyIf: request.headers });
  if (object === null) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const contentType = headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (
    contentType === undefined ||
    !ALLOWED_GAME_ASSET_CONTENT_TYPES.has(contentType)
  ) {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  headers.set("cache-control", GAME_ASSET_CACHE_CONTROL);
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");

  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }
  if (!isR2ObjectBody(object)) {
    return new Response(null, { headers, status: 304 });
  }

  return new Response(object.body, { headers });
}

function isR2ObjectBody(object: R2Object): object is R2ObjectBody {
  return "body" in object;
}

function parseGameAssetKey(pathname: string): string | null {
  const encodedKey = pathname.slice(GAME_ASSET_PATH_PREFIX.length);
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return null;
  }

  if (
    key.length === 0 ||
    key.length > 512 ||
    key.includes("\\") ||
    key.includes("%")
  ) {
    return null;
  }

  const segments = key.split("/");
  if (
    segments.length < 2 ||
    !ALLOWED_GAME_ASSET_NAMESPACES.has(segments[0] ?? "") ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        hasControlCharacter(segment),
    ) ||
    !ALLOWED_GAME_ASSET_EXTENSION.test(segments.at(-1) ?? "")
  ) {
    return null;
  }

  return key;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

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
