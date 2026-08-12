import type { PublicCardCatalog } from "@disastar/game-engine";
import { AttributeIcon } from "./attribute-icon.tsx";
import { CardArtwork } from "./card-artwork.tsx";
import {
  cardTypeLabel,
  cardTypeMark,
  getAttributeLabel,
} from "./card-presentation.ts";
import { cn } from "@/lib/utils";

type CardDefinition = NonNullable<PublicCardCatalog["definitions"][string]>;

export function BoardCard({
  definition,
  power,
  requiredMana,
  sequenceLabel,
  size,
  tone = "faction",
}: {
  definition: CardDefinition;
  power?: number;
  requiredMana?: number;
  sequenceLabel?: string;
  size: "field" | "hand" | "preview";
  tone?: "faction" | "opponent" | "self";
}) {
  const usesRedFrame =
    tone === "opponent" ||
    (tone === "faction" && definition.faction === "disaster");
  return (
    <article
      className={cn(
        "relative isolate grid overflow-hidden border bg-[#04080b] text-[#e1e3e2] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_3px_9px_rgba(0,0,0,.58)] [clip-path:polygon(6px_0,calc(100%_-_4px)_0,100%_4px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,4px_100%,0_calc(100%_-_4px),0_6px)] before:pointer-events-none before:absolute before:inset-[3px] before:z-30 before:border before:border-white/[.09] after:pointer-events-none after:absolute after:inset-0 after:z-20 after:bg-[linear-gradient(135deg,rgba(255,255,255,.045),transparent_18%,transparent_80%,rgba(0,0,0,.4))]",
        usesRedFrame
          ? "border-[#7f332e] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_0_8px_rgba(151,35,25,.12)]"
          : "border-[#2f6684] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_0_8px_rgba(35,107,147,.14)]",
        size === "field"
          ? "h-full w-full grid-rows-[24px_minmax(92px,1.45fr)_minmax(88px,1fr)] [@media(max-height:800px)]:grid-rows-[18px_minmax(48px,1.45fr)_minmax(42px,1fr)]"
          : size === "hand"
            ? "h-[154px] w-[118px] grid-rows-[20px_78px_56px] transition-[transform,filter] duration-150 group-hover:-translate-y-[3px] group-hover:brightness-[1.07] group-focus-within:-translate-y-[3px] motion-reduce:transition-none max-[1300px]:w-[96px]"
            : "h-[286px] w-[190px] grid-rows-[24px_148px_114px]",
      )}
      data-attribute={definition.attribute}
      data-card-size={size}
      data-card-type={definition.cardType}
      data-faction={definition.faction}
    >
      <header className="relative z-10 flex items-center justify-between border-b border-white/[.08] bg-[#030608]/92 px-[8px]">
        <span
          className={cn(
            "font-medium tracking-[.05em]",
            size === "hand" ? "text-[11px]" : "text-[16px]",
          )}
        >
          {sequenceLabel ?? cardTypeMark(definition.cardType)}
        </span>
        <span
          className={cn(
            "tracking-[.06em] text-[#e6e4dd]",
            size === "hand" ? "text-[8px]" : "text-[9px]",
          )}
        >
          COST {definition.cost ?? "—"}
        </span>
      </header>
      <div className="relative min-h-0 overflow-hidden border-b border-white/[.09] bg-[#0b151b]">
        <CardArtwork
          attribute={definition.attribute}
          cardName={definition.name}
          faction={definition.faction}
          imageAssetId={definition.imageAssetId}
        />
        <span
          className={cn(
            "absolute top-[8px] left-[6px] z-10 grid border bg-[#07131a]/90 shadow-[0_0_8px_rgba(0,0,0,.65)]",
            size === "hand"
              ? "size-[22px] place-items-center"
              : "size-[30px] place-items-center",
            definition.faction === "disaster"
              ? "border-[#7f392d] text-[#e2a450]"
              : "border-[#2e6682] text-[#62b6df]",
          )}
        >
          <AttributeIcon
            attribute={definition.attribute}
            faction={definition.faction}
          />
        </span>
        <span
          className={cn(
            "absolute right-[4px] bottom-[3px] z-10 border border-white/[.12] bg-black/75 px-[5px] py-[1px] tracking-[.08em] text-[#bec6c9]",
            size === "hand" ? "text-[7px]" : "text-[8px]",
          )}
        >
          {cardTypeLabel(definition.cardType)}
        </span>
      </div>
      <div className="relative z-10 grid min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] bg-[linear-gradient(180deg,rgba(5,10,13,.94),rgba(1,4,6,.98))] px-[7px] pt-[3px] pb-[5px] text-center">
        <strong
          className={cn(
            "truncate border-b border-white/[.06] font-medium leading-tight text-[#f0f0ec]",
            size === "hand" ? "pb-[2px] text-[11px]" : "pb-[3px] text-[15px]",
          )}
        >
          {definition.name}
        </strong>
        <span
          className={cn(
            "border-b border-white/[.06] tracking-[.09em]",
            definition.attribute === "attributeA"
              ? "text-[#c8a35f]"
              : definition.attribute === "attributeB"
                ? "text-[#5cb5e4]"
                : "text-[#b18bc2]",
            size === "hand" ? "py-[1px] text-[8px]" : "py-[2px] text-[10px]",
          )}
        >
          {getAttributeLabel(definition.faction, definition.attribute)}
        </span>
        <div
          className={cn(
            "grid grid-cols-2 divide-x divide-white/[.08] border-b border-white/[.07]",
            size === "hand" ? "py-[1px] text-[8px]" : "py-[3px] text-[13px]",
          )}
        >
          <span>◇ {requiredMana ?? definition.cost ?? "—"}</span>
          <span className="text-[#e9b13d]">
            ⚡ {power ?? definition.basePower ?? "—"}
          </span>
        </div>
        <p
          className={cn(
            "min-h-0 overflow-hidden text-[#afb7b9]",
            size === "hand"
              ? "pt-[2px] text-[7px] leading-[1.2]"
              : "pt-[4px] text-[9px] leading-[1.25]",
          )}
        >
          {getRulesSummary(definition.rulesText)}
        </p>
      </div>
    </article>
  );
}

function getRulesSummary(rulesText: string): string {
  const gameEffect = rulesText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("ゲーム上の効果:"));
  if (gameEffect !== undefined) {
    return gameEffect.replace(/^ゲーム上の効果:\s*/, "");
  }
  return rulesText.split("\n").find((line) => line.trim().length > 0) ?? "";
}
