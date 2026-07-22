import type { GamePhase } from "../contracts/game-state.js";
import type { PlayerId } from "../contracts/identifiers.js";

export function getPlacementPlayerId(
  phase: GamePhase,
  firstPlayerId: PlayerId,
  secondPlayerId: PlayerId,
): PlayerId | null {
  if (phase === "firstPlayerPlacement") {
    return firstPlayerId;
  }
  if (phase === "secondPlayerPlacement") {
    return secondPlayerId;
  }
  return null;
}
