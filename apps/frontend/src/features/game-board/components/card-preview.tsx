import type { PublicCardCatalog } from "@disastar/game-engine";
import {
  cardTypeLabel,
  cardTypeMark,
  getAttributeLabel,
  getChainableCardNames,
} from "./card-presentation.ts";

export function CardPreviewContent({
  catalog,
  definition,
  unavailableReason,
}: {
  catalog: PublicCardCatalog;
  definition: NonNullable<PublicCardCatalog["definitions"][string]>;
  unavailableReason?: string;
}) {
  const chainableCardNames = getChainableCardNames(catalog, definition);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#91a6ad]">
            {cardTypeLabel(definition.cardType)} /{" "}
            {getAttributeLabel(definition.faction, definition.attribute)}
          </p>
          <strong>{definition.name}</strong>
        </div>
        <span className="text-2xl text-[#e5c778]" aria-hidden="true">
          {cardTypeMark(definition.cardType)}
        </span>
      </div>
      <dl className="mt-3 flex gap-4 border-y border-white/[.09] py-2 text-xs">
        <div>
          <dt className="text-[#91a6ad]">コスト</dt>
          <dd className="font-semibold">{definition.cost ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-[#91a6ad]">攻撃力</dt>
          <dd className="font-semibold">{definition.basePower ?? "-"}</dd>
        </div>
      </dl>
      <p className="mt-3 whitespace-pre-line text-xs leading-5 text-[#c1ced2]">
        {definition.rulesText}
      </p>
      {definition.cardType === "attack" ? (
        <p className="mt-3 border-t border-white/[.1] pt-3 text-xs leading-5 text-[#c1ced2]">
          <span className="text-[#91a6ad]">連鎖可能なカード: </span>
          {chainableCardNames.length === 0
            ? "なし"
            : chainableCardNames.join("、")}
        </p>
      ) : null}
      {unavailableReason === undefined ? null : (
        <p className="mt-3 border-t border-[#8a453a]/60 pt-3 text-xs text-[#e8a49e]">
          {unavailableReason}
        </p>
      )}
    </>
  );
}
