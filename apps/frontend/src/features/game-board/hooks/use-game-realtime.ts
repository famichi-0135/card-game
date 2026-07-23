import type { GameRealtimeUpdate } from "@disastar/contracts/game";
import { useEffect, useRef } from "react";

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 10_000] as const;

/**
 * 盤面更新の即時通知を受信する。正規状態は通知内容を信用せず、呼び出し元で
 * HTTPスナップショットを取り直す。
 */
export function useGameRealtime({
  enabled,
  gameId,
  onUpdate,
}: {
  enabled: boolean;
  gameId: string;
  onUpdate: (update: GameRealtimeUpdate) => void;
}): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || typeof WebSocket === "undefined") {
      return;
    }

    let disposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;

    const connect = () => {
      const url = new URL(
        `/api/games/${encodeURIComponent(gameId)}/events`,
        window.location.origin,
      );
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
      });
      socket.addEventListener("message", (event) => {
        const update = parseGameRealtimeUpdate(event.data, gameId);
        if (update !== null) {
          onUpdateRef.current(update);
        }
      });
      socket.addEventListener("close", (event) => {
        if (disposed || event.code === 1008) {
          return;
        }

        const delay =
          RECONNECT_DELAYS_MS[
            Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
          ] ?? RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1];
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      });
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
      }
      socket?.close(1000, "ゲーム画面を離れました。");
    };
  }, [enabled, gameId]);
}

function parseGameRealtimeUpdate(
  value: unknown,
  gameId: string,
): GameRealtimeUpdate | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      parsed.type !== "GAME_UPDATED" ||
      parsed.gameId !== gameId ||
      !isNonNegativeSafeInteger(parsed.stateVersion) ||
      !isNonNegativeSafeInteger(parsed.latestEventSequence)
    ) {
      return null;
    }
    return {
      type: "GAME_UPDATED",
      gameId: parsed.gameId,
      stateVersion: parsed.stateVersion,
      latestEventSequence: parsed.latestEventSequence,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
