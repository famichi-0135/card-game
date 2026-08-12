import { useId } from "react";
import { cn } from "@/lib/utils";
import type { HudColorVariant } from "./hud-variants.ts";
import { hudVariantGlowColors } from "./hud-variants.ts";

export function GameButtonFrame({
  variant,
}: {
  variant: Extract<HudColorVariant, "blue" | "gold" | "gray">;
}) {
  const gradientId = `button-metal-${useId().replaceAll(":", "")}`;
  const accent = hudVariantGlowColors[variant];
  const palette = {
    blue: {
      bevel: "#a8d5ef",
      highlight: "#e3f5ff",
      shadow: "#041019",
    },
    gold: {
      bevel: "#f2d7a5",
      highlight: "#fff3d3",
      shadow: "#20170e",
    },
    gray: {
      bevel: "#c1c5c9",
      highlight: "#eef0ef",
      shadow: "#111518",
    },
  }[variant];

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-30 size-full overflow-visible transition-[filter] duration-[120ms] group-active:brightness-75 group-active:drop-shadow-none motion-reduce:transition-none",
        variant === "gold" &&
          "group-hover:drop-shadow-[0_0_3px_rgba(255,200,87,.55)]",
        variant === "blue" &&
          "group-hover:drop-shadow-[0_0_3px_rgba(74,139,255,.5)]",
      )}
      data-frame-lighting="interactive"
      data-frame-palette={variant}
      data-metal-layer="frame"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 200 56"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={palette.highlight} stopOpacity=".76" />
          <stop offset=".16" stopColor={accent} stopOpacity=".82" />
          <stop offset=".58" stopColor={accent} stopOpacity=".46" />
          <stop offset="1" stopColor={palette.shadow} stopOpacity=".96" />
        </linearGradient>
      </defs>
      <path
        d="M9 1.8H191L198.2 9V47L191 54.2H9L1.8 47V9Z"
        data-frame-path="shadow-contour"
        fill="none"
        stroke="#010203"
        strokeWidth="5"
      />
      <path
        d="M9 2.5H191L197.5 9V47L191 53.5H9L2.5 47V9Z"
        data-frame-path="main-metal"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.2"
      />
      <path
        d="M11.5 6H188.5L194 11.5V44.5L188.5 50H11.5L6 44.5V11.5Z"
        data-frame-path="recessed-edge"
        fill="none"
        stroke="#050708"
        strokeWidth="3"
      />
      <path
        d="M12 7H188L193 12V44L188 49H12L7 44V12Z"
        data-frame-path="inner-contour"
        fill="none"
        stroke={accent}
        strokeOpacity=".48"
        strokeWidth="1"
      />
      <path
        d="M13 5H187M8 10L12 6M188 6L192 10"
        data-frame-path="top-highlight"
        fill="none"
        stroke={palette.highlight}
        strokeLinecap="square"
        strokeOpacity=".54"
        strokeWidth=".75"
      />
      <path
        d="M4.5 18V39M195.5 18V39M19 52H181"
        data-frame-path="dark-lower-edge"
        fill="none"
        stroke="#000"
        strokeOpacity=".9"
        strokeWidth="1.2"
      />
      <path
        d="M3 14H7V9H12M188 9H193V14M3 42H7V47H12M188 47H193V42"
        data-frame-path="corner-plates"
        fill="none"
        stroke={accent}
        strokeOpacity=".68"
        strokeWidth="1"
      />
      <path
        d="M9 2.5L13 6.5M191 2.5L187 6.5M9 53.5L13 49.5M191 53.5L187 49.5"
        data-frame-path="bevel-cuts"
        fill="none"
        stroke={palette.bevel}
        strokeOpacity=".48"
        strokeWidth=".8"
      />
    </svg>
  );
}
