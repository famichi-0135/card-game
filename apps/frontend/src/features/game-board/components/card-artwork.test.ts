import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardArtwork } from "./card-artwork.tsx";

describe("カード画像", () => {
  it("imageAssetIdがあるカードだけR2画像を遅延読み込みする", () => {
    const markup = renderToStaticMarkup(
      createElement(CardArtwork, {
        cardName: "河川氾濫",
        imageAssetId: "cards/catalog-v4/flood.abc123.webp",
      }),
    );

    expect(markup).toContain(
      'src="/game-assets/cards/catalog-v4/flood.abc123.webp"',
    );
    expect(markup).toContain('alt="河川氾濫のカード画像"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('decoding="async"');
  });

  it("imageAssetIdがない場合は属性を識別できるプレースホルダー画像を描画する", () => {
    const markup = renderToStaticMarkup(
      createElement(CardArtwork, {
        attribute: "attributeB",
        cardName: "河川氾濫",
        faction: "disaster",
        imageAssetId: null,
      }),
    );

    expect(markup).toContain('data-card-artwork="placeholder"');
    expect(markup).toContain('src="/ui-assets/card-art-disaster-water.svg"');
    expect(markup).toContain('alt="河川氾濫のプレースホルダー画像"');
  });
});
