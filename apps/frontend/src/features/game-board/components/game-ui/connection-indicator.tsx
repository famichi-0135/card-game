import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { GameButtonFrame } from "./game-button-frame.tsx";

type ConnectionIndicatorState =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "resynchronizing"
  | "error";

const defaultLabels: Record<ConnectionIndicatorState, string> = {
  connected: "接続済み",
  disconnected: "未接続",
  reconnecting: "再接続中",
  resynchronizing: "再同期中",
  error: "復旧できません",
};

export function ConnectionIndicator({
  className,
  label,
  state,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label?: string;
  state: ConnectionIndicatorState;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "relative isolate flex h-[34px] items-center gap-[8px] overflow-hidden px-[13px] font-['Noto_Sans_JP','Yu_Gothic_UI',sans-serif] text-[12px] font-medium tracking-[.04em] [clip-path:polygon(5px_0,calc(100%_-_5px)_0,100%_5px,100%_calc(100%_-_5px),calc(100%_-_5px)_100%,5px_100%,0_calc(100%_-_5px),0_5px)] before:pointer-events-none before:absolute before:inset-[4px] before:z-10 before:bg-[radial-gradient(circle_at_35%_0%,rgba(255,255,255,.05),transparent_45%),linear-gradient(180deg,rgba(20,24,25,.92),rgba(3,7,9,.96))] before:shadow-[inset_0_0_10px_rgba(0,0,0,.82)] data-[connection-indicator=connected]:text-[#4fc46a] data-[connection-indicator=disconnected]:text-[#8b8f96] data-[connection-indicator=error]:text-[#e24a4a] data-[connection-indicator=reconnecting]:text-[#ffc857] data-[connection-indicator=resynchronizing]:text-[#4a8bff]",
        className,
      )}
      data-connection-indicator={state}
      role="status"
      {...props}
    >
      <GameButtonFrame variant="gray" />
      <span
        aria-hidden="true"
        className="relative z-40 size-[9px] rounded-full border border-current/60 bg-current shadow-[0_0_3px_currentColor] data-[indicator-state=connected]:shadow-[0_0_4px_currentColor,0_0_9px_color-mix(in_srgb,currentColor_45%,transparent)]"
        data-indicator-state={state}
      />
      <span className="relative z-40 whitespace-nowrap">
        {label ?? defaultLabels[state]}
      </span>
    </div>
  );
}
