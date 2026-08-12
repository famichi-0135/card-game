import { getGameAssetUrl } from "./game-asset-url.ts";
import type { Attribute, Faction } from "@disastar/game-engine";

export function CardArtwork({
  cardName,
  faction = "disaster",
  attribute = "attributeA",
  imageAssetId,
}: {
  attribute?: Attribute;
  cardName: string;
  faction?: Faction;
  imageAssetId: string | null;
}) {
  const imageUrl = getGameAssetUrl(imageAssetId);

  if (imageUrl === null) {
    return (
      <img
        alt={`${cardName}のプレースホルダー画像`}
        className="h-full w-full object-cover brightness-[.95] contrast-[1.08] saturate-[.88]"
        data-card-artwork="placeholder"
        decoding="async"
        loading="lazy"
        src={getPlaceholderArtwork(faction, attribute)}
      />
    );
  }

  return (
    <img
      alt={`${cardName}のカード画像`}
      className="h-full w-full object-cover brightness-[.92] contrast-[1.08] saturate-[.82]"
      decoding="async"
      loading="lazy"
      src={imageUrl}
    />
  );
}

function getPlaceholderArtwork(faction: Faction, attribute: Attribute): string {
  const subject = faction === "disaster" ? "disaster" : "countermeasure";
  const element = {
    attributeA: "earth",
    attributeB: "water",
    attributeC: "air",
  }[attribute];
  return `/ui-assets/card-art-${subject}-${element}.svg`;
}
