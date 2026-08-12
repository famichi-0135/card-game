import type { Attribute, PlayerGameView } from "@disastar/game-engine";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getAttributeLabel } from "./card-presentation.ts";
import { AttributeIcon } from "./attribute-icon.tsx";
import { GameFrame } from "./game-ui/index.ts";

const attributes: readonly Attribute[] = [
  "attributeA",
  "attributeB",
  "attributeC",
];

type BoardPlayer = PlayerGameView["self"] | PlayerGameView["opponent"];

export function ManaPanel({
  compact = false,
  footer,
  label,
  perspective = "self",
  player,
}: {
  compact?: boolean;
  footer?: ReactNode;
  label: string;
  perspective?: "opponent" | "self";
  player: BoardPlayer;
}) {
  return (
    <GameFrame
      as="section"
      aria-label={`${label}のみなもと`}
      className={cn(
        "h-full min-h-0 p-[12px] text-[#dce5e6]",
        compact ? "bg-[#100b0c]" : "bg-[#071018]",
      )}
      variant={perspective === "opponent" ? "red" : "blue"}
    >
      <div className="relative z-10 flex items-baseline justify-between gap-2 border-b border-white/[.1] pb-[7px]">
        <p className="text-[11px] font-medium tracking-[.12em] text-[#d7dde0]">
          {label.toUpperCase()} / みなもと
        </p>
        <span className="text-[8px] tracking-[.1em] text-[#81949b]">
          {perspective === "self" ? "AVAILABLE" : "PUBLIC"}
        </span>
      </div>
      <dl className="relative z-10 mt-[8px] grid gap-[5px]">
        {attributes.map((attribute) => {
          const mana = player.mana[attribute];
          return (
            <div
              className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-[7px] border-b border-white/[.06] pb-[4px] last:border-0"
              key={attribute}
            >
              <span className="text-[#d0ad6d]" aria-hidden="true">
                <AttributeIcon attribute={attribute} faction={player.faction} />
              </span>
              <div className="min-w-0 leading-tight">
                <dt className="truncate text-[11px]">
                  {getAttributeLabel(player.faction, attribute)}
                </dt>
                <dd className="whitespace-nowrap text-[8px] text-[#809198]">
                  使用可 {mana.available} / {mana.total}
                </dd>
              </div>
              <strong className="shrink-0 border border-white/[.15] bg-black/35 px-[6px] py-[3px] font-mono text-[13px] tabular-nums text-[#f0c878]">
                {mana.available}
              </strong>
            </div>
          );
        })}
      </dl>
      {footer === undefined ? null : (
        <div className="relative z-10 mt-[7px]">{footer}</div>
      )}
    </GameFrame>
  );
}
