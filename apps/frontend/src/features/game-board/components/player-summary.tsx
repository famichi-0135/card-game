import type { PlayerGameView } from "@disastar/game-engine";

type BoardPlayer = PlayerGameView["self"] | PlayerGameView["opponent"];

export function PlayerSummary({
  player,
  label,
  onOpenDiscard,
}: {
  player: BoardPlayer;
  label: string;
  onOpenDiscard: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col justify-between rounded-md border border-slate-300 p-3">
      <div>
        <p className="text-xs font-medium text-slate-500">PLAYER</p>
        <h2 className="mt-1 text-lg font-semibold">{label}</h2>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <dt className="text-xs text-slate-500">スタミナ</dt>
          <dd className="font-semibold">{player.stamina}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">山札</dt>
          <dd className="font-semibold">{player.deckCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">手札</dt>
          <dd className="font-semibold">{player.handCount}</dd>
        </div>
      </dl>
      <button
        className="rounded border border-slate-300 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        onClick={onOpenDiscard}
        type="button"
      >
        捨て札 {player.discardPile.length} 枚
      </button>
    </aside>
  );
}
