import type { PlayerGameView } from "@disastar/game-engine";
import { Link } from "react-router";

export function GameResultDialog({ view }: { view: PlayerGameView }) {
  const outcome = getOutcome(view);
  const finalRound = view.lastRoundResult?.round ?? view.round;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-6">
      <section
        aria-labelledby="game-result-dialog-title"
        aria-modal="true"
        className="w-full max-w-2xl rounded-md border border-slate-300 bg-white shadow-sm"
        role="dialog"
      >
        <header className="border-b border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500">GAME RESULT</p>
          <h2
            className="mt-1 text-2xl font-semibold"
            id="game-result-dialog-title"
          >
            {outcome.title}
          </h2>
        </header>

        <div className="p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-slate-200 pb-5 text-sm">
            <div>
              <dt className="text-slate-500">最終ラウンド</dt>
              <dd className="mt-1 text-lg font-semibold">{finalRound}</dd>
            </div>
            <div>
              <dt className="text-slate-500">終了理由</dt>
              <dd className="mt-1 font-medium">{outcome.reason}</dd>
            </div>
          </dl>

          <section className="mt-5" aria-labelledby="game-result-score-title">
            <h3 className="text-sm font-semibold" id="game-result-score-title">
              最終結果
            </h3>
            <table className="mt-3 w-full border-collapse text-left text-sm">
              <thead className="border-y border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">プレイヤー</th>
                  <th className="py-2 text-right font-medium">スタミナ</th>
                  <th className="py-2 text-right font-medium">総パワー</th>
                </tr>
              </thead>
              <tbody>
                <ResultRow
                  label="あなた"
                  stamina={view.self.stamina}
                  totalPower={
                    view.lastRoundResult?.totalPowers[view.self.playerId] ??
                    null
                  }
                />
                <ResultRow
                  label="相手"
                  stamina={view.opponent.stamina}
                  totalPower={
                    view.lastRoundResult?.totalPowers[view.opponent.playerId] ??
                    null
                  }
                />
              </tbody>
            </table>
          </section>
        </div>

        <footer className="flex justify-end border-t border-slate-200 p-4">
          <Link
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/"
          >
            トップへ戻る
          </Link>
        </footer>
      </section>
    </div>
  );
}

function ResultRow({
  label,
  stamina,
  totalPower,
}: {
  label: string;
  stamina: number;
  totalPower: number | null;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <th className="py-3 font-medium">{label}</th>
      <td className="py-3 text-right tabular-nums">{stamina}</td>
      <td className="py-3 text-right tabular-nums">
        {totalPower === null ? "記録なし" : totalPower}
      </td>
    </tr>
  );
}

function getOutcome(view: PlayerGameView): { reason: string; title: string } {
  const winner = view.winner;
  if (winner === null) {
    return {
      title: "ゲーム終了",
      reason: "終了結果を確認できませんでした。",
    };
  }
  if (winner.type === "draw") {
    return {
      title: "引き分け",
      reason: getDrawReason(winner.reason),
    };
  }

  return {
    title: winner.playerId === view.viewerPlayerId ? "勝利" : "敗北",
    reason: getPlayerWinReason(winner.reason),
  };
}

function getPlayerWinReason(
  reason: Extract<
    NonNullable<PlayerGameView["winner"]>,
    { type: "player" }
  >["reason"],
): string {
  switch (reason) {
    case "stamina":
      return "相手のスタミナが 0 になりました。";
    case "deckOut":
      return "相手の山札が尽きました。";
    case "maxRoundStamina":
      return "最終ラウンドのスタミナが上回りました。";
    case "maxRoundPower":
      return "最終ラウンドの総パワーが上回りました。";
  }
}

function getDrawReason(
  reason: Extract<
    NonNullable<PlayerGameView["winner"]>,
    { type: "draw" }
  >["reason"],
): string {
  switch (reason) {
    case "bothStaminaZero":
      return "双方のスタミナが 0 になりました。";
    case "deckOutEqualStamina":
      return "双方の山札が尽き、スタミナが同じでした。";
    case "maxRoundEqual":
      return "最終ラウンドのスタミナと総パワーが同じでした。";
  }
}
