import { describe, expect, it } from "vitest";
import { getGameAssetUrl } from "./game-asset-url.ts";

describe("ゲーム画像URL", () => {
  it("R2オブジェクトキーを同一オリジンの配信URLへ変換する", () => {
    expect(getGameAssetUrl("cards/catalog-v4/attack-flood.abc123.webp")).toBe(
      "/game-assets/cards/catalog-v4/attack-flood.abc123.webp",
    );
  });

  it("日本語を含む安全なキーをパス単位でエンコードする", () => {
    expect(getGameAssetUrl("cards/catalog-v4/河川氾濫.webp")).toBe(
      "/game-assets/cards/catalog-v4/%E6%B2%B3%E5%B7%9D%E6%B0%BE%E6%BF%AB.webp",
    );
  });

  it("画像IDがない場合と危険なキーではURLを作らない", () => {
    expect(getGameAssetUrl(null)).toBeNull();
    expect(getGameAssetUrl("cards/../private.webp")).toBeNull();
    expect(getGameAssetUrl("cards\\private.webp")).toBeNull();
    expect(getGameAssetUrl("cards/catalog-v4/card.svg")).toBeNull();
  });
});
