import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { HudColorVariant } from "./hud-variants.ts";
import { hudVariantTextClasses } from "./hud-variants.ts";

export function FrameLine({
  className,
  variant = "gray",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: HudColorVariant }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-[18px] min-w-[120px] items-center",
        hudVariantTextClasses[variant],
        className,
      )}
      data-frame-line={variant}
      {...props}
    >
      <LineCap side="left" />
      <StretchLine />
      <CenterDiamond />
      <StretchLine />
      <LineCap side="right" />
    </div>
  );
}

function StretchLine() {
  return (
    <svg
      className="h-[10px] min-w-0 flex-1"
      preserveAspectRatio="none"
      viewBox="0 0 100 10"
    >
      <path d="M0 6H100" stroke="#010203" strokeWidth="5" />
      <path d="M0 5H100" stroke="currentColor" strokeOpacity=".7" />
      <path d="M0 3.5H100" stroke="#fff" strokeOpacity=".24" />
      <path d="M0 7H100" stroke="#000" strokeOpacity=".85" />
    </svg>
  );
}

function LineCap({ side }: { side: "left" | "right" }) {
  return (
    <svg
      className={cn("h-[14px] w-[30px]", side === "right" && "rotate-180")}
      viewBox="0 0 30 14"
    >
      <path
        d="M1 7L7 2H30V12H7Z"
        fill="#020405"
        stroke="currentColor"
        strokeOpacity=".72"
      />
      <path d="M6 5H25" stroke="#fff" strokeOpacity=".24" />
      <path d="M8 9H30" stroke="#000" strokeOpacity=".9" strokeWidth="2" />
      <path d="M10 2L6 7L10 12" fill="none" stroke="currentColor" />
    </svg>
  );
}

function CenterDiamond() {
  return (
    <svg className="size-[18px] shrink-0" viewBox="0 0 18 18">
      <path
        d="M9 1L17 9L9 17L1 9Z"
        data-line-ornament="center-diamond"
        fill="#020507"
        stroke="currentColor"
        strokeOpacity=".78"
      />
      <path
        d="M9 4L14 9L9 14L4 9Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".55"
      />
      <path d="M9 6V12M6 9H12" stroke="#fff" strokeOpacity=".32" />
    </svg>
  );
}
