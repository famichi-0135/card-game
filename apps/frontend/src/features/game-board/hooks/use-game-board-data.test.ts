import type { GameSnapshotResponse } from "@disastar/contracts/game";
import { describe, expect, it } from "vitest";
import { createGameBoardFixture } from "../fixtures/game-board-fixture.ts";
import {
  createGameCommandRequest,
  mergeGameSnapshot,
} from "./use-game-board-data.ts";

describe("ゲーム盤面の同期データ", () => {
  it("遅れて到着した古いスナップショットで、より新しい盤面を上書きしない", () => {
    const current = createSnapshot({
      gameId: "snapshot-order",
      latestEventSequence: 25,
      stateVersion: 14,
    });
    const delayed = createSnapshot({
      gameId: "snapshot-order",
      latestEventSequence: 24,
      stateVersion: 13,
    });

    expect(mergeGameSnapshot(current, delayed)).toBe(current);
  });

  it("状態バージョンが進んだスナップショットだけを正規状態にする", () => {
    const current = createSnapshot({
      gameId: "snapshot-newer",
      latestEventSequence: 25,
      stateVersion: 14,
    });
    const newer = createSnapshot({
      gameId: "snapshot-newer",
      latestEventSequence: 26,
      stateVersion: 15,
    });

    expect(mergeGameSnapshot(current, newer)).toBe(newer);
  });

  it("同じ状態バージョンでもイベント連番が古い応答を捨てる", () => {
    const current = createSnapshot({
      gameId: "snapshot-events",
      latestEventSequence: 25,
      stateVersion: 14,
    });
    const delayed = createSnapshot({
      gameId: "snapshot-events",
      latestEventSequence: 24,
      stateVersion: 14,
    });

    expect(mergeGameSnapshot(current, delayed)).toBe(current);
  });

  it("同じ更新通知による重複スナップショットで演出用イベントを巻き戻さない", () => {
    const current = createSnapshot({
      gameId: "snapshot-duplicate",
      latestEventSequence: 25,
      stateVersion: 14,
    });
    const duplicate = createSnapshot({
      gameId: "snapshot-duplicate",
      latestEventSequence: 25,
      stateVersion: 14,
    });

    expect(mergeGameSnapshot(current, duplicate)).toBe(current);
  });

  it("再送しても同じコマンドID・同じ本文をPOSTする", () => {
    const command = {
      commandId: "command-retry-1",
      gameId: "retry-game",
      playerId: "player-disaster",
      phaseSequence: 7,
      clientStateVersion: 12,
      issuedAt: 1_700_000_000_000,
      type: "FINISH_PLACEMENT" as const,
    };

    const firstRequest = createGameCommandRequest("retry-game", command);
    const retriedRequest = createGameCommandRequest("retry-game", command);

    expect(retriedRequest).toEqual(firstRequest);
    expect(retriedRequest.path).toBe("/api/games/retry-game/commands");
    expect(retriedRequest.init.body).toBe(JSON.stringify({ command }));
  });
});

function createSnapshot({
  gameId,
  latestEventSequence,
  stateVersion,
}: {
  gameId: string;
  latestEventSequence: number;
  stateVersion: number;
}): GameSnapshotResponse {
  const fixture = createGameBoardFixture(gameId);

  return {
    events: fixture.events,
    latestEventSequence,
    view: { ...fixture.view, stateVersion },
  };
}
