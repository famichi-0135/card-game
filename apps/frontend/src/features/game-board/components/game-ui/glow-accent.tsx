import { useId } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { HudColorVariant } from "./hud-variants.ts";
import { hudVariantGlowColors } from "./hud-variants.ts";

type GlowVariant = Exclude<HudColorVariant, "gray">;

export function GlowAccent({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant: GlowVariant }) {
  const blurId = `glow-blur-${useId().replaceAll(":", "")}`;
  const color = hudVariantGlowColors[variant];
  return (
    <span
      aria-hidden="true"
      className={cn("block h-[24px] w-full", className)}
      data-glow-accent={variant}
      {...props}
    >
      <svg className="size-full overflow-visible" viewBox="0 0 400 24">
        <defs>
          <filter id={blurId} x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <line
          data-glow-layer="halo"
          filter={`url(#${blurId})`}
          stroke={color}
          strokeOpacity=".55"
          strokeWidth="5"
          x1="20"
          x2="380"
          y1="12"
          y2="12"
        />
        <line
          data-glow-layer="base"
          stroke="#020405"
          strokeWidth="3"
          x1="10"
          x2="390"
          y1="12"
          y2="12"
        />
        <line
          data-glow-layer="bright-line"
          stroke={color}
          strokeOpacity=".86"
          x1="28"
          x2="372"
          y1="12"
          y2="12"
        />
        <g data-glow-layer="center-flare">
          <circle cx="200" cy="12" fill={color} opacity=".42" r="8" />
          <circle cx="200" cy="12" fill="#fff" r="2.5" />
          <path d="M200 3V21M188 12H212" stroke="#fff" strokeOpacity=".9" />
        </g>
      </svg>
    </span>
  );
}
