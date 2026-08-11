const GAME_ASSET_BASE_PATH = "/game-assets";
const ALLOWED_GAME_ASSET_NAMESPACES = new Set([
  "backgrounds",
  "cards",
  "portraits",
  "ui",
]);
const ALLOWED_GAME_ASSET_EXTENSION = /\.(?:avif|jpe?g|png|webp)$/i;

export function getGameAssetUrl(imageAssetId: string | null): string | null {
  if (!isSafeGameAssetKey(imageAssetId)) {
    return null;
  }

  return `${GAME_ASSET_BASE_PATH}/${imageAssetId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function isSafeGameAssetKey(value: string | null): value is string {
  if (value === null || value.length === 0 || value.length > 512) {
    return false;
  }
  if (
    value.includes("\\") ||
    value.includes("%") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return false;
  }

  const segments = value.split("/");
  if (
    segments.length < 2 ||
    !ALLOWED_GAME_ASSET_NAMESPACES.has(segments[0] ?? "") ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        hasControlCharacter(segment),
    )
  ) {
    return false;
  }

  return ALLOWED_GAME_ASSET_EXTENSION.test(segments.at(-1) ?? "");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}
