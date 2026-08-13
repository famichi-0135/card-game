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
  if (size === "field") {
    return (
      <FieldCard
        definition={definition}
        power={power}
        requiredMana={requiredMana}
        sequenceLabel={sequenceLabel}
        usesRedFrame={usesRedFrame}
      />
    );
  }
  return (
    <article
      className={cn(
        "relative isolate grid overflow-hidden border bg-[#04080b] text-[#e1e3e2] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_3px_9px_rgba(0,0,0,.58)] [clip-path:polygon(6px_0,calc(100%_-_4px)_0,100%_4px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,4px_100%,0_calc(100%_-_4px),0_6px)] before:pointer-events-none before:absolute before:inset-[3px] before:z-30 before:border before:border-white/[.09] after:pointer-events-none after:absolute after:inset-0 after:z-20 after:bg-[linear-gradient(135deg,rgba(255,255,255,.045),transparent_18%,transparent_80%,rgba(0,0,0,.4))]",
        usesRedFrame
          ? "border-[#7f332e] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_0_8px_rgba(151,35,25,.12)]"
          : "border-[#2f6684] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_0_8px_rgba(35,107,147,.14)]",
        size === "hand"
          ? "h-[154px] w-[118px] grid-rows-[20px_78px_56px] transition-[transform,filter] duration-150 group-hover:-translate-y-[3px] group-hover:brightness-[1.07] group-focus-within:-translate-y-[3px] motion-reduce:transition-none max-[1300px]:w-[96px]"
          : "h-[286px] w-[190px] grid-rows-[24px_148px_114px]",
      )}
      data-attribute={definition.attribute}
      data-card-size={size}
      data-card-type={definition.cardType}
      data-faction={definition.faction}
    >
      <header className="relative z-10 flex items-center justify-between border-b border-white/[.08] bg-[#030608]/92 px-[6px]">
        <span
          className={cn(
            "grid place-items-center border bg-black/60 font-mono font-medium leading-none",
            size === "hand"
              ? "size-[15px] text-[9px]"
              : "size-[19px] text-[11px]",
            usesRedFrame
              ? "border-[#8a453a]/80 text-[#e8a49e]"
              : "border-[#3d6e8c]/80 text-[#a8c8f0]",
          )}
        >
          {sequenceLabel ?? cardTypeMark(definition.cardType)}
        </span>
        <span
          className={cn(
            "tracking-[.08em] text-[#e6e4dd]",
            size === "hand" ? "text-[8px]" : "text-[9px]",
          )}
        >
          COST <span className="font-mono text-[#f0cf84]">{definition.cost ?? "—"}</span>
        </span>
      </header>
      <div className="relative min-h-0 overflow-hidden border-b border-white/[.09] bg-[#0b151b] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(180deg,transparent_52%,rgba(3,6,9,.88)_98%)] after:content-['']">
        <CardArtwork
          attribute={definition.attribute}
          cardName={definition.name}
          faction={definition.faction}
          imageAssetId={definition.imageAssetId}
        />
        <span
          className={cn(
            "absolute top-[6px] left-[6px] z-10 grid place-items-center border bg-[#050c12]/92 shadow-[0_0_8px_rgba(0,0,0,.65),inset_0_0_4px_rgba(0,0,0,.8)] [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]",
            size === "hand" ? "size-[24px]" : "size-[32px]",
            definition.faction === "disaster"
              ? "border-[#7f392d] text-[#e2a450]"
              : "border-[#2e6682] text-[#62b6df]",
          )}
        >
          <AttributeIcon
            attribute={definition.attribute}
            faction={definition.faction}
            size={size === "hand" ? 11 : 14}
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
            "truncate border-b border-white/[.08] font-semibold leading-tight tracking-[.04em] text-[#f5f4ee] [text-shadow:0_1px_1px_#000]",
            size === "hand" ? "pb-[2px] text-[11px]" : "pb-[3px] text-[15px]",
          )}
        >
          {definition.name}
        </strong>
        <span
          className={cn(
            "flex items-center justify-center gap-[4px] border-b border-white/[.06] tracking-[.09em]",
            definition.attribute === "attributeA"
              ? "text-[#c8a35f]"
              : definition.attribute === "attributeB"
                ? "text-[#5cb5e4]"
                : "text-[#b18bc2]",
            size === "hand" ? "py-[1px] text-[8px]" : "py-[2px] text-[10px]",
          )}
        >
          <span aria-hidden="true" className="text-[6px]">
            ◆
          </span>
          {getAttributeLabel(definition.faction, definition.attribute)}
        </span>
        <div
          className={cn(
            "grid grid-cols-2 divide-x divide-white/[.08] border-b border-white/[.07]",
            size === "hand" ? "py-[1px] text-[8px]" : "py-[3px] text-[13px]",
          )}
        >
          <span className="font-mono tabular-nums text-[#cfd8d9]">
            ◇ {requiredMana ?? definition.cost ?? "—"}
          </span>
          <span className="font-mono tabular-nums text-[#e9b13d] [text-shadow:0_0_6px_rgba(233,177,61,.3)]">
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

function FieldCard({
  definition,
  power,
  requiredMana,
  sequenceLabel,
  usesRedFrame,
}: {
  definition: CardDefinition;
  power?: number;
  requiredMana?: number;
  sequenceLabel?: string;
  usesRedFrame: boolean;
}) {
  return (
    <article
      className={cn(
        "relative isolate mx-auto h-[min(100%,calc(100cqw*154/118))] w-auto max-w-full aspect-[118/154] overflow-hidden border bg-[#04080b] text-[#e1e3e2] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_3px_9px_rgba(0,0,0,.58)] [clip-path:polygon(6px_0,calc(100%_-_4px)_0,100%_4px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,4px_100%,0_calc(100%_-_4px),0_6px)]",
        usesRedFrame
          ? "border-[#7f332e] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_0_8px_rgba(151,35,25,.12)]"
          : "border-[#2f6684] shadow-[inset_0_0_0_2px_rgba(0,0,0,.84),inset_0_0_18px_rgba(0,0,0,.88),0_0_8px_rgba(35,107,147,.14)]",
      )}
      data-attribute={definition.attribute}
      data-card-size="field"
      data-card-type={definition.cardType}
      data-faction={definition.faction}
    >
      <CardArtwork
        attribute={definition.attribute}
        cardName={definition.name}
        faction={definition.faction}
        imageAssetId={definition.imageAssetId}
      />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,9,.28)_0%,transparent_28%,transparent_62%,rgba(3,6,9,.88)_100%)]" />
      <span
        className={cn(
          "absolute top-[5px] left-[5px] z-10 grid size-[18px] place-items-center border bg-[#050c12]/92 shadow-[0_0_8px_rgba(0,0,0,.65)] [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]",
          definition.faction === "disaster"
            ? "border-[#7f392d] text-[#e2a450]"
            : "border-[#2e6682] text-[#62b6df]",
        )}
      >
        <AttributeIcon
          attribute={definition.attribute}
          faction={definition.faction}
          size={9}
        />
      </span>
      <span className="absolute top-[5px] right-[5px] z-10 border border-white/[.14] bg-black/75 px-[4px] py-px font-mono text-[8px] tracking-[.08em] text-[#f0cf84]">
        {definition.cost ?? "—"}
      </span>
      <div className="absolute inset-x-0 bottom-0 z-10 px-[5px] pb-[4px] pt-[10px]">
        <strong className="block truncate text-center text-[9px] font-semibold leading-tight tracking-[.04em] text-[#f5f4ee] [text-shadow:0_1px_2px_#000]">
          {definition.name}
        </strong>
        <span className="mt-[2px] flex items-center justify-center gap-[6px] font-mono text-[8px] tabular-nums">
          <span className="text-[#cfd8d9]">
            ◇ {requiredMana ?? definition.cost ?? "—"}
          </span>
          <span className="text-[#e9b13d]">
            ⚡ {power ?? definition.basePower ?? "—"}
          </span>
        </span>
      </div>
      <span className="sr-only">
        {sequenceLabel ?? cardTypeMark(definition.cardType)}{" "}
        {cardTypeLabel(definition.cardType)}{" "}
        {getAttributeLabel(definition.faction, definition.attribute)}
      </span>
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
