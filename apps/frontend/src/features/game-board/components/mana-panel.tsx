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

const attributeTones: Record<Attribute, { bar: string; icon: string }> = {
  attributeA: { bar: "bg-[#c8a35f]", icon: "text-[#d8b275]" },
  attributeB: { bar: "bg-[#5cb5e4]", icon: "text-[#7cc6ec]" },
  attributeC: { bar: "bg-[#b18bc2]", icon: "text-[#c39fd2]" },
};

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
        "flex h-full min-h-0 flex-col p-[10px] text-[#dce5e6]",
        compact ? "bg-[#100b0c]" : "bg-[#071018]",
      )}
      variant={perspective === "opponent" ? "red" : "blue"}
    >
      <div className="relative z-10 flex items-baseline justify-between gap-2 border-b border-white/[.1] pb-[6px]">
        <p className="text-[10px] font-medium tracking-[.14em] text-[#d7dde0]">
          みなもと（{label}）
        </p>
        <span className="text-[8px] tracking-[.1em] text-[#81949b]">
          {perspective === "self" ? "AVAILABLE" : "PUBLIC"}
        </span>
      </div>
      <dl className="relative z-10 mt-[7px] grid min-h-0 flex-1 grid-cols-3 gap-[6px]">
        {attributes.map((attribute) => {
          const mana = player.mana[attribute];
          const tone = attributeTones[attribute];
          const ratio =
            mana.total <= 0
              ? 0
              : Math.max(0, Math.min(1, mana.available / mana.total));
          return (
            <div
              className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden border border-white/[.09] bg-[linear-gradient(180deg,rgba(10,17,22,.9),rgba(3,6,9,.95))] px-[4px] py-[6px] shadow-[inset_0_0_12px_rgba(0,0,0,.7)]"
              key={attribute}
            >
              {perspective === "self" ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -right-[6px] -bottom-[8px] opacity-[.07]",
                    tone.icon,
                  )}
                >
                  <AttributeIcon
                    attribute={attribute}
                    faction={player.faction}
                    size={46}
                  />
                </span>
              ) : null}
              <span className={cn("flex items-center gap-[3px]", tone.icon)}>
                <AttributeIcon
                  attribute={attribute}
                  faction={player.faction}
                  size={12}
                />
                <dt className="max-w-full truncate text-[8px] tracking-[.04em] text-[#c4cdd0]">
                  {getAttributeLabel(player.faction, attribute)}
                </dt>
              </span>
              <dd
                className={cn(
                  "mt-[3px] font-mono leading-none tabular-nums text-[#f2f4f1] [text-shadow:0_1px_1px_#000]",
                  perspective === "self" ? "text-[30px]" : "text-[20px]",
                )}
              >
                {mana.available}
              </dd>
              <dd className="mt-[3px] whitespace-nowrap text-[7px] tracking-[.04em] text-[#7d8f96]">
                使用可 {mana.available} / {mana.total}
              </dd>
              {perspective === "self" ? (
                <span
                  aria-hidden="true"
                  className="mt-[4px] h-[3px] w-full bg-white/[.06]"
                >
                  <span
                    className={cn("block h-full", tone.bar)}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </dl>
      {perspective === "self" ? (
        <div className="relative z-10 mt-[7px] flex items-center justify-between border-t border-white/[.1] px-[2px] pt-[6px]">
          <span className="text-[8px] tracking-[.18em] text-[#81949b]">
            TOTAL
          </span>
          <span className="font-mono text-[12px] tabular-nums text-[#dfe8e6]">
            {attributes.reduce(
              (sum, attribute) => sum + player.mana[attribute].available,
              0,
            )}
            <span className="mx-[3px] text-[#6d7f88]">/</span>
            <span className="text-[#9fb0b5]">
              {attributes.reduce(
                (sum, attribute) => sum + player.mana[attribute].total,
                0,
              )}
            </span>
          </span>
        </div>
      ) : null}
      {footer === undefined ? null : (
        <div className="relative z-10 mt-[7px] min-h-0 flex-1">{footer}</div>
      )}
    </GameFrame>
  );
}
