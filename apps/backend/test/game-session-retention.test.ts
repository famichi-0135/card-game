import { describe, expect, it } from "vitest";
import type { GameEventEnvelope } from "@disastar/game-engine/contracts";
import {
  MAX_RETAINED_GAME_EVENT_BYTES,
  MAX_RETAINED_GAME_EVENTS,
  MAX_STORED_COMMAND_RESULT_BYTES,
  compactGameEvents,
  createEventRetentionMetadata,
  isJsonValueWithinCommandResultStorageLimit,
} from "../src/game-session/game-session.js";

describe("GameSession の履歴保持上限", () => {
  it("イベントを新しい順に1024件まで保持する", () => {
    const events = Array.from(
      { length: MAX_RETAINED_GAME_EVENTS + 5 },
      (_, index) => createEvent(index + 1),
    );

    const retained = compactGameEvents(events);

    expect(retained).toHaveLength(MAX_RETAINED_GAME_EVENTS);
    expect(retained[0]?.sequence).toBe(6);
    expect(retained.at(-1)?.sequence).toBe(MAX_RETAINED_GAME_EVENTS + 5);
  });

  it("イベントのJSON表現を512KiB以下に収める", () => {
    const events = Array.from({ length: 20 }, (_, index) =>
      createEvent(index + 1, "x".repeat(40 * 1024)),
    );

    const retained = compactGameEvents(events);
    const byteLength = new TextEncoder().encode(
      JSON.stringify(retained),
    ).length;

    expect(byteLength).toBeLessThanOrEqual(MAX_RETAINED_GAME_EVENT_BYTES);
    expect(retained.at(-1)?.sequence).toBe(20);
  });

  it("要求位置より前が切り詰め済みかをスナップショットへ明示する", () => {
    const retained = [createEvent(10), createEvent(11)];

    expect(createEventRetentionMetadata(retained, 0, 11)).toEqual({
      eventsComplete: false,
      firstAvailableEventSequence: 10,
    });
    expect(createEventRetentionMetadata(retained, 9, 11)).toEqual({
      eventsComplete: true,
      firstAvailableEventSequence: 10,
    });
    expect(createEventRetentionMetadata(retained, 12, 11)).toEqual({
      eventsComplete: false,
      firstAvailableEventSequence: 10,
    });
  });

  it("個別コマンド結果のJSON表現を128KiBまでに制限する", () => {
    expect(
      isJsonValueWithinCommandResultStorageLimit(
        "x".repeat(MAX_STORED_COMMAND_RESULT_BYTES - 2),
      ),
    ).toBe(true);
    expect(
      isJsonValueWithinCommandResultStorageLimit(
        "x".repeat(MAX_STORED_COMMAND_RESULT_BYTES - 1),
      ),
    ).toBe(false);
  });
});

function createEvent(sequence: number, padding = ""): GameEventEnvelope {
  return {
    sequence,
    stateVersion: sequence,
    occurredAt: sequence,
    event: {
      type: "PHASE_CHANGED",
      phase: "support",
      phaseSequence: sequence,
      padding,
    },
  } as unknown as GameEventEnvelope;
}
