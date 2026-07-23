const matchIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function parseMatchId(value: string): string | null {
  const trimmed = value.trim();
  if (matchIdPattern.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const matchId =
      segments.length === 2 && segments[0] === "rooms" ? segments[1] : null;
    return matchId !== null && matchIdPattern.test(matchId) ? matchId : null;
  } catch {
    return null;
  }
}

export function createRoomPath(matchId: string): string {
  return `/rooms/${encodeURIComponent(matchId)}`;
}
