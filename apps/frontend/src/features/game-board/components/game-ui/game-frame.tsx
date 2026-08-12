import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FrameCorner } from "./frame-corner.tsx";
import { FrameLine } from "./frame-line.tsx";
import type { HudColorVariant } from "./hud-variants.ts";
import { hudVariantTextClasses } from "./hud-variants.ts";

type GameFrameProps = {
  as?: Extract<ElementType, "aside" | "div" | "section">;
  children?: ReactNode;
  className?: string;
  variant?: HudColorVariant;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">;

export function GameFrame({
  as: Component = "div",
  children,
  className,
  variant = "gray",
  ...props
}: GameFrameProps) {
  return (
    <Component
      className={cn(
        "relative isolate overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.03),transparent_34%),repeating-linear-gradient(106deg,rgba(255,255,255,.012)_0,rgba(255,255,255,.012)_1px,transparent_1px,transparent_7px),linear-gradient(180deg,rgba(7,16,23,.97),rgba(2,6,9,.98))] shadow-[inset_0_0_28px_rgba(0,0,0,.9),0_4px_16px_rgba(0,0,0,.34)] [clip-path:polygon(8px_0,calc(100%_-_8px)_0,100%_8px,100%_calc(100%_-_8px),calc(100%_-_8px)_100%,8px_100%,0_calc(100%_-_8px),0_8px)]",
        className,
      )}
      data-frame-border-source="svg"
      data-game-frame={variant}
      data-panel-material="textured-metal"
      {...props}
    >
      <PanelMetalBorder variant={variant} />
      <FrameLine
        className="absolute inset-x-[7px] top-[-7px] z-[4]"
        variant={variant}
      />
      <FrameLine
        className="absolute inset-x-[7px] bottom-[-7px] z-[4] rotate-180"
        variant={variant}
      />
      <FrameCorner
        className="absolute top-0 left-0 z-[5] w-[48px]"
        variant={variant}
      />
      <FrameCorner
        className="absolute top-0 right-0 z-[5] w-[48px] rotate-90"
        variant={variant}
      />
      <FrameCorner
        className="absolute right-0 bottom-0 z-[5] w-[48px] rotate-180"
        variant={variant}
      />
      <FrameCorner
        className="absolute bottom-0 left-0 z-[5] w-[48px] -rotate-90"
        variant={variant}
      />
      {children}
    </Component>
  );
}

function PanelMetalBorder({ variant }: { variant: HudColorVariant }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-[3] size-full",
        hudVariantTextClasses[variant],
      )}
      data-panel-border-geometry="linear-edges"
      data-panel-border-svg={variant}
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path
        d="M1 1H99V99H1Z"
        fill="none"
        stroke="#010203"
        strokeWidth="5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1 1H99V99H1Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".68"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.8 1.8H98.2V98.2H1.8Z"
        fill="none"
        stroke="#050708"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2.7 2.7H97.3V97.3H2.7Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".32"
        strokeWidth=".75"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4 2.2H96M2.2 4V46"
        fill="none"
        stroke="#fff"
        strokeOpacity=".22"
        strokeWidth=".7"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M97.8 54V97.8H4"
        fill="none"
        stroke="#000"
        strokeOpacity=".9"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M11 1.2H16M84 1.2H89M11 98.8H16M84 98.8H89M1.2 14V20M98.8 14V20M1.2 80V86M98.8 80V86"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".58"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
