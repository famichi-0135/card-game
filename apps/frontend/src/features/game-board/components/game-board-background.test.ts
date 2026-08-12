import { describe, expect, it } from "vitest";
import {
  BOARD_BACKGROUND_ASSET_ID,
  getBoardBackgroundImage,
} from "./game-board-background.ts";

describe("ゲームボード背景", () => {
  it("R2へ保存した都市俯瞰画像を不変なオブジェクトキーで参照する", () => {
    expect(BOARD_BACKGROUND_ASSET_ID).toBe(
      "backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png",
    );
  });

  it("R2画像を優先し、ローカル開発では既存textureへフォールバックする", () => {
    expect(getBoardBackgroundImage()).toBe(
      'url("/game-assets/backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png"), url("/ui-assets/tactical-map.svg")',
    );
  });
});
