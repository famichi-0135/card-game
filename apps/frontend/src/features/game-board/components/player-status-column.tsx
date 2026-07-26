import type { PlayerGameView } from "@disastar/game-engine";
import { PlayerSummary } from "./player-summary.tsx";

export function PlayerStatusColumn({
  opponent,
  opponentOnline,
  self,
  selfPhaseLabel,
}: {
  opponent: PlayerGameView["opponent"];
  opponentOnline: boolean;
  self: PlayerGameView["self"];
  selfPhaseLabel: string;
}) {
  return (
    <aside
      aria-label="プレイヤーステータス"
      className="grid min-h-0 grid-rows-2 gap-3"
      data-board-region="player-status"
    >
      <PlayerSummary
        label="相手"
        player={opponent}
        status={opponentOnline ? "接続中" : "未接続"}
      />
      <PlayerSummary label="自分" player={self} status={selfPhaseLabel} />
    </aside>
  );
}
