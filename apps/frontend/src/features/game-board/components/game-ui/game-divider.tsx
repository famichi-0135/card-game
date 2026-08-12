import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GameDivider({
  className,
  variant = "solid",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: "solid" | "dotted" | "decorative";
}) {
  const decorative = variant === "decorative";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-[24px] w-full items-center text-[#8b8f96]",
        className,
      )}
      data-game-divider={variant}
      {...props}
    >
      <DividerLine dotted={variant === "dotted"} />
      <svg
        className={cn("shrink-0", decorative ? "size-[30px]" : "size-[14px]")}
        viewBox="0 0 30 30"
      >
        <path
          d="M15 2L28 15L15 28L2 15Z"
          fill="#020507"
          stroke="currentColor"
          strokeOpacity={decorative ? ".82" : ".52"}
        />
        <path
          d="M15 7L23 15L15 23L7 15Z"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".46"
        />
        <path d="M15 10V20M10 15H20" stroke="#fff" strokeOpacity=".26" />
      </svg>
      <DividerLine dotted={variant === "dotted"} />
    </div>
  );
}

function DividerLine({ dotted }: { dotted: boolean }) {
  return (
    <svg
      className="h-[10px] min-w-0 flex-1"
      preserveAspectRatio="none"
      viewBox="0 0 100 10"
    >
      <path d="M0 6H100" stroke="#000" strokeOpacity=".9" strokeWidth="3" />
      <path
        d="M0 5H100"
        stroke="currentColor"
        strokeDasharray={dotted ? "5 7" : undefined}
        strokeOpacity=".5"
      />
      <path
        d="M0 3.8H100"
        stroke="#fff"
        strokeDasharray={dotted ? "5 7" : undefined}
        strokeOpacity=".12"
      />
    </svg>
  );
}
