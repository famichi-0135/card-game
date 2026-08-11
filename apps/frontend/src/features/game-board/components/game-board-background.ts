import { getGameAssetUrl } from "./game-asset-url.ts";

export const BOARD_BACKGROUND_ASSET_ID =
  "backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png";

const BOARD_BACKGROUND_FALLBACK_URL = "/ui-assets/tactical-map.svg";

export function getBoardBackgroundImage(): string {
  const assetUrl = getGameAssetUrl(BOARD_BACKGROUND_ASSET_ID);
  if (assetUrl === null) {
    return `url("${BOARD_BACKGROUND_FALLBACK_URL}")`;
  }

  return `url("${assetUrl}"), url("${BOARD_BACKGROUND_FALLBACK_URL}")`;
}
