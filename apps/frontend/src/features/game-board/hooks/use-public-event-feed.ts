import type {
  PlayerId,
  PlayerVisibleEventEnvelope,
} from "@disastar/game-engine";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_VISIBLE_EVENTS = 3;

export type PublicEventFeedItem = {
  message: string;
  sequence: number;
};

export function usePublicEventFeed({
  events,
  gameId,
  latestEventSequence,
  viewerPlayerId,
}: {
  events: readonly PlayerVisibleEventEnvelope[];
  gameId: string;
  latestEventSequence: number;
  viewerPlayerId: PlayerId;
}) {
  const lastSequenceRef = useRef<number | null>(null);
  const [items, setItems] = useState<PublicEventFeedItem[]>([]);
  const [needsResynchronization, setNeedsResynchronization] = useState(false);

  useEffect(() => {
    lastSequenceRef.current = null;
    setItems([]);
    setNeedsResynchronization(false);
  }, [gameId]);

  useEffect(() => {
    if (needsResynchronization) {
      return;
    }

    const receivedEvents = getNewEvents(events, lastSequenceRef.current);
    if (receivedEvents.length === 0) {
      if (
        lastSequenceRef.current !== null &&
        latestEventSequence > lastSequenceRef.current
      ) {
        setNeedsResynchronization(true);
      }
      return;
    }

    if (
      (lastSequenceRef.current !== null &&
        receivedEvents[0]?.sequence !== lastSequenceRef.current + 1) ||
      !hasContiguousSequences(receivedEvents) ||
      latestEventSequence >
        (receivedEvents[receivedEvents.length - 1]?.sequence ?? 0)
    ) {
      setNeedsResynchronization(true);
      return;
    }

    lastSequenceRef.current =
      receivedEvents[receivedEvents.length - 1]?.sequence ??
      lastSequenceRef.current;
    setItems((current) =>
      [
        ...current,
        ...receivedEvents.map((event) => toFeedItem(event, viewerPlayerId)),
      ].slice(-MAX_VISIBLE_EVENTS),
    );
  }, [events, latestEventSequence, needsResynchronization, viewerPlayerId]);

  const acknowledgeResynchronization = useCallback(() => {
    lastSequenceRef.current = latestEventSequence;
    setItems([]);
    setNeedsResynchronization(false);
  }, [latestEventSequence]);

  return {
    acknowledgeResynchronization,
    items,
    needsResynchronization,
  };
}

function getNewEvents(
  events: readonly PlayerVisibleEventEnvelope[],
  lastSequence: number | null,
): PlayerVisibleEventEnvelope[] {
  const bySequence = new Map<number, PlayerVisibleEventEnvelope>();
  for (const event of events) {
    if (lastSequence === null || event.sequence > lastSequence) {
      bySequence.set(event.sequence, event);
    }
  }
  return [...bySequence.values()].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

function hasContiguousSequences(
  events: readonly PlayerVisibleEventEnvelope[],
): boolean {
  return events.every(
    (event, index) =>
      index === 0 || event.sequence === events[index - 1]!.sequence + 1,
  );
}

function toFeedItem(
  envelope: PlayerVisibleEventEnvelope,
  viewerPlayerId: PlayerId,
): PublicEventFeedItem {
  return {
    message: getEventMessage(envelope, viewerPlayerId),
    sequence: envelope.sequence,
  };
}

function getEventMessage(
  envelope: PlayerVisibleEventEnvelope,
  viewerPlayerId: PlayerId,
): string {
  const { event } = envelope;
  const player = (playerId: PlayerId) =>
    playerId === viewerPlayerId ? "あなた" : "相手";

  switch (event.type) {
    case "GAME_STARTED":
      return "対戦を開始しました";
    case "ROUND_STARTED":
      return `ラウンド ${event.round} を開始しました`;
    case "PHASE_CHANGED":
      return `${getPhaseLabel(event.phase)}フェーズになりました`;
    case "CARDS_DRAWN":
      return `${player(event.playerId)}がカードを ${event.count} 枚引きました`;
    case "MANA_GAINED":
      return `${player(event.playerId)}のみなもとが ${event.amount} 増えました`;
    case "CARD_DISCARDED":
      return `${player(event.playerId)}が手札を破棄しました`;
    case "ATTACK_GROUP_CREATED":
      return `${player(event.playerId)}が攻撃カードを配置しました`;
    case "CARD_CHAINED":
      return `${player(event.playerId)}が攻撃カードを連鎖しました`;
    case "ATTACK_GROUP_REMOVED":
      return `${player(event.playerId)}の攻撃グループを整理しました`;
    case "SUPPORT_CARD_PLAYED":
      return `${player(event.playerId)}がサポートカードを使用しました`;
    case "SUPPORT_FINISHED":
      return `${player(event.playerId)}がサポートを終了しました`;
    case "SUPPORT_PHASE_ENDED":
      return "サポートフェーズを終了しました";
    case "POWER_CALCULATED":
      return "攻撃力を計算しました";
    case "STAMINA_CHANGED":
      return `${player(event.playerId)}のスタミナが ${event.after} になりました`;
    case "ROUND_RESOLVED":
      return `ラウンド ${event.result.round} を解決しました`;
    case "GAME_FINISHED":
      return getGameFinishedMessage(event.winner, viewerPlayerId);
    case "CARD_EFFECT_ACTIVATED":
      return "カード効果を発動しました";
    case "CARD_EFFECT_RESOLVED":
      return "カード効果を解決しました";
    case "ACTIVE_EFFECT_ADDED":
      return "継続効果を適用しました";
    case "ACTIVE_EFFECT_REMOVED":
      return "継続効果が終了しました";
    case "MANA_REDUCED":
      return `${player(event.playerId)}のみなもとが ${event.actualAmount} 減りました`;
    case "SUPPORT_CARD_REMOVED":
      return `${player(event.playerId)}のサポートカードを取り除きました`;
  }
}

function getPhaseLabel(phase: string): string {
  switch (phase) {
    case "firstPlayerPlacement":
    case "secondPlayerPlacement":
      return "配置";
    case "support":
      return "サポート";
    case "resolution":
      return "解決";
    case "cleanup":
      return "整理";
    case "refill":
      return "補充";
    case "finished":
      return "終了";
    default:
      return "準備";
  }
}

function getGameFinishedMessage(
  winner: Extract<
    PlayerVisibleEventEnvelope["event"],
    { type: "GAME_FINISHED" }
  >["winner"],
  viewerPlayerId: PlayerId,
): string {
  if (winner.type === "draw") {
    return "ゲームは引き分けで終了しました";
  }
  return winner.playerId === viewerPlayerId
    ? "あなたの勝利でゲームを終了しました"
    : "相手の勝利でゲームを終了しました";
}
