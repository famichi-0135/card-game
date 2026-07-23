import type { PlayerGameView } from "@disastar/game-engine";

type PhasePresentation = {
  label: string;
  instruction: string;
};

type PhasePresentationView = Pick<
  PlayerGameView,
  "phase" | "firstPlayerId" | "secondPlayerId" | "viewerPlayerId"
> & {
  self: Pick<PlayerGameView["self"], "supportFinished">;
  opponent: Pick<PlayerGameView["opponent"], "supportFinished">;
};

/** 閲覧者から見たフェーズ名と操作案内を作る。 */
export function getPhasePresentation(
  view: PhasePresentationView,
): PhasePresentation {
  switch (view.phase) {
    case "firstPlayerPlacement":
      return placementPresentation(view.firstPlayerId === view.viewerPlayerId);
    case "secondPlayerPlacement":
      return placementPresentation(view.secondPlayerId === view.viewerPlayerId);
    case "support":
      return supportPresentation(
        view.self.supportFinished,
        view.opponent.supportFinished,
      );
    case "resolution":
      return { label: "解決", instruction: "ラウンド結果を計算しています" };
    case "cleanup":
      return { label: "整理", instruction: "場を整理しています" };
    case "refill":
      return { label: "補充", instruction: "手札を補充しています" };
    case "finished":
      return { label: "終了", instruction: "ゲームは終了しました" };
    case "initializing":
      return { label: "準備中", instruction: "ゲームを準備しています" };
  }
}

function placementPresentation(isViewerTurn: boolean): PhasePresentation {
  return isViewerTurn
    ? {
        label: "あなたの配置",
        instruction: "あなたのターンです。攻撃カードを配置または連鎖できます",
      }
    : {
        label: "相手の配置",
        instruction: "相手のターンです。相手の配置が終わるまでお待ちください",
      };
}

function supportPresentation(
  selfFinished: boolean,
  opponentFinished: boolean,
): PhasePresentation {
  if (selfFinished && !opponentFinished) {
    return {
      label: "サポート",
      instruction: "あなたは終了済みです。相手のサポート操作を待っています",
    };
  }
  if (!selfFinished && opponentFinished) {
    return {
      label: "サポート",
      instruction:
        "相手は終了済みです。サポートカードを使用するか終了してください",
    };
  }
  return {
    label: "サポート",
    instruction: "サポートカードを使用するか、サポートを終了してください",
  };
}
