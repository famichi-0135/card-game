import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { HudColorVariant } from "./hud-variants.ts";
import { hudVariantTextClasses } from "./hud-variants.ts";

export function FrameCorner({
  className,
  variant = "gray",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: HudColorVariant }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none block aspect-[1.24/1] w-[112px]",
        hudVariantTextClasses[variant],
        className,
      )}
      data-frame-corner={variant}
      {...props}
    >
      <svg
        className="size-full overflow-visible"
        fill="none"
        focusable="false"
        viewBox="0 0 112 90"
      >
        <path
          d="M4 86V23L23 4H108"
          data-corner-path="shadow"
          stroke="#010203"
          strokeWidth="6"
        />
        <path
          d="M4 86V23L23 4H108"
          data-corner-path="main"
          stroke="currentColor"
          strokeOpacity=".78"
          strokeWidth="2"
        />
        <path
          d="M10 86V27L27 10H108"
          data-corner-path="inner"
          stroke="currentColor"
          strokeOpacity=".42"
          strokeWidth="1"
        />
        <path
          d="M7 64V25L25 7H74M29 12L14 29V51"
          data-corner-path="highlight"
          stroke="#fff"
          strokeOpacity=".34"
          strokeWidth=".8"
        />
        <path
          d="M15 86V67H20V35L35 20H67V15H91"
          data-corner-path="recess"
          stroke="#000"
          strokeOpacity=".9"
          strokeWidth="2.4"
        />
        <path
          d="M2 53H7M2 43H7M42 2V7M53 2V7M72 2V7"
          data-corner-path="notches"
          stroke="currentColor"
          strokeOpacity=".68"
          strokeWidth="1.2"
        />
        <path
          d="M17 36L22 31L27 36L22 41Z"
          data-corner-ornament="rivet"
          fill="#020507"
          stroke="currentColor"
          strokeOpacity=".88"
        />
        <path
          d="M22 33V39M19 36H25"
          stroke="#fff"
          strokeOpacity=".38"
          strokeWidth=".7"
        />
      </svg>
    </span>
  );
}
