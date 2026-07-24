import type { PlayerGameView } from "@disastar/game-engine";
import type { ReactNode } from "react";

type BoardPlayer = PlayerGameView["self"] | PlayerGameView["opponent"];

export function PlayerSummary({
  player,
  label,
  status,
}: {
  player: BoardPlayer;
  label: string;
  status?: ReactNode;
}) {
  return (
    <section
      aria-label={`${label}のステータス`}
      className="flex min-h-0 flex-col justify-between rounded-md border border-slate-300 bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">PLAYER</p>
          <h2 className="mt-1 text-lg font-semibold">{label}</h2>
        </div>
        {status === undefined ? null : (
          <div className="text-right text-xs text-slate-500">{status}</div>
        )}
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
    </section>
  );
}
