import type {
  GameEventEnvelope,
  PlayerId,
  PlayerVisibleEventEnvelope,
} from "../contracts/index.js";

export function projectEventForPlayer(
  envelope: GameEventEnvelope,
  viewerPlayerId: PlayerId,
): PlayerVisibleEventEnvelope | null {
  if (envelope.event.type !== "CARDS_DRAWN") {
    return {
      ...envelope,
      event: envelope.event,
    };
  }

  const { cardInstanceIds, ...visibleEvent } = envelope.event;
  return {
    ...envelope,
    event: {
      ...visibleEvent,
      count: cardInstanceIds.length,
      ...(envelope.event.playerId === viewerPlayerId
        ? { cardInstanceIds: [...cardInstanceIds] }
        : {}),
    },
  };
}
