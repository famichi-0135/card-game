import type { ReactNode } from "react";
import type { GameConnectionState } from "./connection-status.tsx";
import type { PublicEventFeedItem } from "../hooks/use-public-event-feed.ts";
import {
  ConnectionIndicator,
  GameFrame,
  PrimaryGameButton,
  SecondaryGameButton,
} from "./game-ui/index.ts";

export function GameProgressBar({
  canFinishPhase,
  canResynchronize,
  commandMessage,
  connectionState,
  finishActionLabel,
  gameId,
  gameAction,
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
  canFinishPhase: boolean;
  canResynchronize: boolean;
  commandMessage: string | null;
  connectionState: GameConnectionState;
  finishActionLabel: string;
  gameId: string;
  gameAction?: ReactNode;
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
    <GameFrame
      as="section"
      aria-label="ゲーム進行"
      className="flex h-[76px] items-stretch gap-[12px] p-[10px] text-[#dfe7e8]"
      data-board-region="game-progress"
      variant="gray"
    >
      <div className="relative z-10 grid w-[108px] shrink-0 grid-cols-[auto_1fr] items-center gap-[7px] border-r border-white/[.12] pr-[12px]">
        <span className="text-[9px] tracking-[.14em] text-[#8ca2aa]">
          ROUND
        </span>
        <strong className="font-mono text-[28px] leading-none tabular-nums text-[#e9cc82]">
          {round}
        </strong>
      </div>
      <div className="relative z-10 min-w-[184px] shrink-0 border-r border-white/[.12] pr-[16px]">
        <span className="block text-[9px] tracking-[.12em] text-[#8ca2aa]">
          現在のフェーズ
        </span>
        <div className="mt-[5px] flex items-center gap-[8px]">
          <strong className="text-[14px] tracking-[.07em]">{phaseLabel}</strong>
          <span className="border border-[#907140] bg-black/30 px-[6px] py-[2px] font-mono text-[12px] tabular-nums text-[#f0cf84]">
            {remainingTime}
          </span>
        </div>
      </div>
      <div className="relative z-10 w-[124px] shrink-0 text-[9px] leading-relaxed text-[#83969d]">
        <p className="truncate">MATCH {gameId}</p>
        <p>
          STATE v{stateVersion} / EVENT {publicEvents.length}
        </p>
      </div>
      <p
        aria-live="polite"
        className="relative z-10 min-w-[180px] flex-1 self-center text-right text-[12px] text-[#bdcccf]"
        role="status"
      >
        {commandMessage ?? phaseInstruction}
      </p>
      <div className="relative z-10 flex shrink-0 items-center justify-end gap-[8px]">
        <ConnectionIndicator
          state={toConnectionIndicatorState(connectionState)}
        />
        {onRetryCommand === undefined ? null : (
          <SecondaryGameButton
            className="min-w-[92px]"
            onClick={onRetryCommand}
          >
            再試行
          </SecondaryGameButton>
        )}
        {!canResynchronize || onResynchronize === undefined ? null : (
          <SecondaryGameButton
            className="min-w-[116px]"
            onClick={onResynchronize}
          >
            盤面を再同期
          </SecondaryGameButton>
        )}
      </div>
      <div className="relative z-10 flex shrink-0 items-center justify-end gap-[8px]">
        <PrimaryGameButton
          className="h-[46px] min-w-[126px] text-[13px]"
          disabled={!canFinishPhase}
          onClick={onFinishPhase}
        >
          {finishActionLabel}
        </PrimaryGameButton>
        {gameAction}
      </div>
    </GameFrame>
  );
}

function toConnectionIndicatorState(state: GameConnectionState) {
  switch (state) {
    case "offline":
      return "disconnected" as const;
    case "unrecoverable":
      return "error" as const;
    default:
      return state;
  }
}
