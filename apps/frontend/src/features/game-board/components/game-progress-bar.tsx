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
  const latestEvent = publicEvents.at(-1)?.message;

  return (
    <GameFrame
      as="section"
      aria-label="ゲーム進行"
      className="flex h-[76px] items-stretch gap-[10px] p-[9px] text-[#dfe7e8]"
      data-board-region="game-progress"
      data-onboarding-target="game-progress"
      variant="gray"
    >
      <HudCell className="w-[100px]" label="ROUND" sub={`v${stateVersion}`}>
        <strong className="font-mono text-[30px] leading-none tabular-nums text-[#e9cc82] [text-shadow:0_0_12px_rgba(233,204,130,.2)]">
          {String(round).padStart(2, "0")}
        </strong>
        <span className="truncate font-mono text-[7px] tracking-[.06em] text-[#5f7079]">
          MATCH {gameId}
        </span>
      </HudCell>
      <HudDivider />
      <HudCell className="min-w-[128px]" label="PHASE">
        <strong className="truncate text-[14px] tracking-[.08em] text-[#eef3f2]">
          {phaseLabel}
        </strong>
      </HudCell>
      <HudDivider />
      <HudCell className="w-[86px]" label="TIME">
        <strong className="font-mono text-[20px] leading-none tabular-nums text-[#f0cf84]">
          {remainingTime}
        </strong>
      </HudCell>
      <HudDivider />
      <HudCell className="min-w-[180px] flex-1" label="MESSAGE">
        <p
          aria-live="polite"
          className="truncate text-[12px] text-[#d3dee0]"
          role="status"
        >
          {commandMessage ?? phaseInstruction}
        </p>
      </HudCell>
      <HudDivider />
      <HudCell
        className="min-w-[170px] flex-[.8]"
        label="EVENT"
        sub={`STATE v${stateVersion} / EVENT ${publicEvents.length}`}
      >
        <p className="truncate text-[11px] text-[#a9bcc2]">
          {latestEvent ?? "イベントはありません"}
        </p>
      </HudCell>
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
          data-onboarding-target="phase-finish"
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

function HudCell({
  children,
  className,
  label,
  sub,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  sub?: string;
}) {
  return (
    <div
      className={`relative z-10 flex min-w-0 shrink-0 flex-col justify-center gap-[3px] ${className ?? ""}`}
    >
      <span className="flex items-baseline justify-between gap-[6px] text-[8px] tracking-[.2em] text-[#7f96a0]">
        {label}
        {sub === undefined ? null : (
          <span className="font-mono text-[7px] tracking-normal text-[#5f7079]">
            {sub}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function HudDivider() {
  return (
    <span
      aria-hidden="true"
      className="relative z-10 w-[5px] self-stretch bg-[linear-gradient(90deg,transparent_0px,transparent_1px,rgba(0,0,0,.9)_1px,rgba(0,0,0,.9)_2px,rgba(139,159,168,.22)_2px,rgba(139,159,168,.22)_3px,transparent_3px)]"
    />
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
