import type { PlayerGameView } from "@disastar/game-engine";
import { ManaPanel } from "./mana-panel.tsx";
import { CardBack } from "./game-ui/index.ts";

export function ResourceColumn({
  onOpenOpponentDiscard,
  onOpenOpponentSupport,
  opponent,
  self,
}: {
  onOpenOpponentDiscard: () => void;
  onOpenOpponentSupport: () => void;
  opponent: PlayerGameView["opponent"];
  self: PlayerGameView["self"];
}) {
  return (
    <aside
      aria-label="みなもと"
      className="grid h-full min-h-0 grid-rows-[clamp(196px,24vh,226px)_minmax(0,1fr)] gap-[10px] overflow-visible"
      data-board-region="resources"
    >
      <div
        className="min-h-0"
        data-resource-panel="opponent"
        data-resource-priority="secondary"
      >
        <ManaPanel
          compact
          footer={
            <div className="flex h-full min-h-0 flex-col gap-[5px]">
              <p className="text-[8px] tracking-[.16em] text-[#88979d]">
                SUPPORT / DISCARD
              </p>
              <div
                className="grid min-h-0 flex-1 grid-cols-2 gap-[10px]"
                data-opponent-public-zones
              >
                <OpponentZoneCardBack
                  count={opponent.supportZone.length}
                  label="サポート"
                  onClick={onOpenOpponentSupport}
                  zone="support"
                />
                <OpponentZoneCardBack
                  count={opponent.discardPile.length}
                  label="捨て札"
                  onClick={onOpenOpponentDiscard}
                  zone="discard"
                />
              </div>
            </div>
          }
          label="相手"
          perspective="opponent"
          player={opponent}
        />
      </div>

      <div
        className="min-h-0"
        data-resource-panel="self"
        data-resource-priority="primary"
      >
        <ManaPanel label="自分" perspective="self" player={self} />
      </div>
    </aside>
  );
}

function OpponentZoneCardBack({
  count,
  label,
  onClick,
  zone,
}: {
  count: number;
  label: string;
  onClick: () => void;
  zone: "discard" | "support";
}) {
  return (
    <button
      aria-label={`相手の${label}`}
      className="group relative min-h-0 transition-[filter] duration-150 hover:brightness-[1.15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1cd7a] motion-reduce:transition-none"
      data-opponent-zone={zone}
      onClick={onClick}
      type="button"
    >
      <CardBack concealed className="size-full" />
      <span className="absolute top-[3px] right-[3px] z-10 border border-[#77603b]/80 bg-black/85 px-[4px] py-px font-mono text-[9px] tabular-nums text-[#efc779]">
        {count}
      </span>
      <span className="absolute inset-x-0 bottom-[4px] z-10 text-center text-[7px] tracking-[.1em] text-[#a99a7c]">
        {label}
      </span>
    </button>
  );
}
