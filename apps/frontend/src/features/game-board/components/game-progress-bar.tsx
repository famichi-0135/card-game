import type { ReactNode } from "react";
import {
  ConnectionStatus,
  type GameConnectionState,
} from "./connection-status.tsx";
import { PublicEventFeed } from "./public-event-feed.tsx";
import type { PublicEventFeedItem } from "../hooks/use-public-event-feed.ts";

export function GameProgressBar({
  accountAction,
  canFinishPhase,
  commandMessage,
  connectionState,
  finishActionLabel,
  gameId,
  onFinishPhase,
  onResynchronize,
  onRetryCommand,
  phaseInstruction,
  phaseLabel,
  publicEvents,
  remainingTime,
  round,
  stateVersion,
}: {
  accountAction?: ReactNode;
  canFinishPhase: boolean;
  commandMessage: string | null;
  connectionState: GameConnectionState;
  finishActionLabel: string;
  gameId: string;
  onFinishPhase: () => void;
  onResynchronize?: () => void;
  onRetryCommand?: () => void;
  phaseInstruction: string;
  phaseLabel: string;
  publicEvents: readonly PublicEventFeedItem[];
  remainingTime: string;
  round: number;
  stateVersion: number;
}) {
  return (
    <section
      aria-label="ゲーム進行"
      className="flex items-stretch gap-2 rounded-md border border-slate-300 bg-white p-2"
      data-board-region="game-progress"
    >
      <div className="shrink-0 rounded border border-slate-200 px-3 py-1  ">
        <span className="block text-xs font-medium text-slate-500">ROUND</span>
        <strong className="text-xl tabular-nums">{round}</strong>
      </div>
      <div className="shrink-0 rounded border border-slate-200 px-3 py-2">
        <span className="block text-xs font-medium text-slate-500">
          現在のフェーズ
        </span>
        <div className="mt-1 flex items-center gap-2">
          <strong className="text-sm">{phaseLabel}</strong>
          <span className="rounded border border-slate-300 px-2 py-1 font-mono text-xs tabular-nums">
            {remainingTime}
          </span>
        </div>
      </div>
      <div className="w-28 shrink-0 text-xs text-slate-500">
        <p className="truncate">対戦 ID: {gameId}</p>
        <p>状態 v{stateVersion}</p>
      </div>
      <p
        aria-live="polite"
        className="min-w-[180px] flex-1 self-center text-right text-sm text-slate-700"
        role="status"
      >
        {commandMessage ?? phaseInstruction}
      </p>
      <div className="w-48 shrink-0 self-center">
        <PublicEventFeed events={publicEvents} gameId={gameId} />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <ConnectionStatus
          onResynchronize={onResynchronize}
          state={connectionState}
        />
        {onRetryCommand === undefined ? null : (
          <button
            className="shrink-0 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            onClick={onRetryCommand}
            type="button"
          >
            再試行
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <button
          className="shrink-0 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          disabled={!canFinishPhase}
          onClick={onFinishPhase}
          type="button"
        >
          {finishActionLabel}
        </button>
        {accountAction}
      </div>
    </section>
  );
}
