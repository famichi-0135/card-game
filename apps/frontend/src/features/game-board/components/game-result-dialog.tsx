import type { PlayerGameView } from "@disastar/game-engine";
import type { GameLearningContextResponse } from "@disastar/contracts/game";
import {
  learningArticles,
  selectLearningArticles,
} from "@disastar/learning-content";
import { Link } from "react-router";
import {
  TACTICAL_MODAL_FOOTER_CLASS,
  TACTICAL_MODAL_HEADER_CLASS,
  TACTICAL_MODAL_OVERLAY_CLASS,
  TACTICAL_MODAL_PRIMARY_BUTTON_CLASS,
  TACTICAL_MODAL_SECONDARY_BUTTON_CLASS,
  TACTICAL_MODAL_SURFACE_CLASS,
} from "@/components/ui/tactical-overlay-theme.ts";
import { UI_LAYER_CLASS } from "@/components/ui/ui-layers.ts";
import { cn } from "@/lib/utils";

export function GameResultDialog({
  learningContext,
  view,
}: {
  learningContext?: {
    data: GameLearningContextResponse | undefined;
    isError: boolean;
    isPending: boolean;
  };
  view: PlayerGameView;
}) {
  const outcome = getOutcome(view);
  const finalRound = view.lastRoundResult?.round ?? view.round;
  const articles =
    learningContext?.data === undefined
      ? []
      : selectLearningArticles(
          learningContext.data.selectedCards.map(
            ({ cardDefinitionId }) => cardDefinitionId,
          ),
          learningArticles,
        );

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-6",
        UI_LAYER_CLASS.modal,
        TACTICAL_MODAL_OVERLAY_CLASS,
      )}
      data-ui-layer="modal"
    >
      <section
        aria-labelledby="game-result-dialog-title"
        aria-modal="true"
        className={cn("w-full max-w-2xl", TACTICAL_MODAL_SURFACE_CLASS)}
        data-modal-theme="tactical-dark"
        role="dialog"
      >
        <header className={cn("border-b p-5", TACTICAL_MODAL_HEADER_CLASS)}>
          <p className="text-xs font-medium tracking-[.14em] text-[#8fa1ac]">
            GAME RESULT
          </p>
          <h2
            className="mt-1 text-2xl font-semibold"
            id="game-result-dialog-title"
          >
            {outcome.title}
          </h2>
        </header>

        <div className="p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-white/[.1] pb-5 text-sm">
            <div>
              <dt className="text-[#8fa1ac]">最終ラウンド</dt>
              <dd className="mt-1 text-lg font-semibold">{finalRound}</dd>
            </div>
            <div>
              <dt className="text-[#8fa1ac]">終了理由</dt>
              <dd className="mt-1 font-medium">{outcome.reason}</dd>
            </div>
          </dl>

          <section className="mt-5" aria-labelledby="game-result-score-title">
            <h3 className="text-sm font-semibold" id="game-result-score-title">
              最終結果
            </h3>
            <table className="mt-3 w-full border-collapse text-left text-sm">
              <thead className="border-y border-white/[.1] text-xs text-[#8fa1ac]">
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

          {learningContext?.isPending ? (
            <p className="mt-5 text-sm text-[#9fb0b8]" role="status">
              関連する防災情報を確認しています。
            </p>
          ) : null}
          {learningContext?.isError ? (
            <p className="mt-5 text-sm text-[#9fb0b8]">
              学習コンテンツを取得できませんでした。
            </p>
          ) : null}
          {articles.length === 0 || learningContext?.isPending ? null : (
            <section className="mt-5 border-t border-white/[.1] pt-5">
              <h3 className="text-sm font-semibold">この対戦から学ぶ</h3>
              <p className="mt-1 text-sm leading-6 text-[#9fb0b8]">
                対戦で使用したカードに関連する防災情報を確認できます。
              </p>
            </section>
          )}
        </div>

        <footer
          className={cn(
            "flex flex-wrap justify-end gap-2 border-t p-4",
            TACTICAL_MODAL_FOOTER_CLASS,
          )}
        >
          {articles.length === 0 || learningContext?.isPending ? null : (
            <Link
              className={
                TACTICAL_MODAL_SECONDARY_BUTTON_CLASS + " px-3 py-2 text-sm"
              }
              to={`/games/${encodeURIComponent(view.gameId)}/learn`}
            >
              学習コンテンツを見る
            </Link>
          )}
          <Link
            className={
              TACTICAL_MODAL_PRIMARY_BUTTON_CLASS + " px-3 py-2 text-sm"
            }
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
    <tr className="border-b border-white/[.07] last:border-b-0">
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

  const viewerWon = winner.playerId === view.viewerPlayerId;
  return {
    title: viewerWon ? "勝利" : "敗北",
    reason: getPlayerWinReason(winner.reason, viewerWon),
  };
}

function getPlayerWinReason(
  reason: Extract<
    NonNullable<PlayerGameView["winner"]>,
    { type: "player" }
  >["reason"],
  viewerWon: boolean,
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
    case "disconnectTimeout":
      return "相手が制限時間までに対戦へ戻りませんでした。";
    case "forfeit":
      return viewerWon
        ? "相手が対戦を中止しました。"
        : "あなたが対戦を中止しました。";
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
    case "bothDisconnected":
      return "双方が制限時間までに対戦へ戻りませんでした。";
  }
}
