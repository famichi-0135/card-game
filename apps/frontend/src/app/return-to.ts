const defaultReturnTo = "/";

export function getSafeReturnTo(
  value: string | null | undefined,
  origin: string = window.location.origin,
): string {
  if (value === null || value === undefined || !value.startsWith("/")) {
    return defaultReturnTo;
  }

  try {
    const trustedOrigin = new URL(origin).origin;
    const target = new URL(value, trustedOrigin);

    if (target.origin !== trustedOrigin) {
      return defaultReturnTo;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return defaultReturnTo;
  }
}

export function createAuthPath(path: string, returnTo: string): string {
  if (returnTo === defaultReturnTo) {
    return path;
  }

  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}
