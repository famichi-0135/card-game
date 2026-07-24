import type { PlayerGameView } from "@disastar/game-engine";
import { ManaPanel } from "./mana-panel.tsx";

export function ResourceColumn({
  onOpenOpponentDiscard,
  opponent,
  self,
}: {
  onOpenOpponentDiscard: () => void;
  opponent: PlayerGameView["opponent"];
  self: PlayerGameView["self"];
}) {
  return (
    <aside
      aria-label="属性とリソース"
      className="grid min-h-0 grid-rows-2 gap-3"
      data-board-region="resources"
    >
      <ManaPanel
        footer={
          <button
            aria-label="相手の捨て札"
            className="w-full rounded border border-slate-300 px-2 py-1 text-left text-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onOpenOpponentDiscard}
            type="button"
          >
            相手の捨て札 {opponent.discardPile.length} 枚
          </button>
        }
        label="相手"
        player={opponent}
      />
      <ManaPanel label="自分" player={self} />
    </aside>
  );
}
