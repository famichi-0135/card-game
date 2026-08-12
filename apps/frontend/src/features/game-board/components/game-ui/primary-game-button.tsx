import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { GameButtonFrame } from "./game-button-frame.tsx";

export function PrimaryGameButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "group relative isolate flex h-[46px] min-w-[164px] items-center justify-center overflow-visible px-[22px] font-['Noto_Sans_JP','Yu_Gothic_UI',sans-serif] text-[15px] font-medium tracking-[.08em] text-[#f2e8d5] [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)] [text-shadow:0_1px_1px_#000,0_0_7px_rgba(255,210,132,.18)] transition-[transform,filter] duration-[120ms] hover:text-[#fff4d8] active:translate-y-px active:brightness-[.84] disabled:cursor-not-allowed disabled:opacity-35 disabled:saturate-50 motion-reduce:transition-none",
        className,
      )}
      data-game-button="primary"
      type={type}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] z-0 opacity-0 shadow-[0_0_4px_rgba(255,200,87,.7),0_0_14px_rgba(255,178,60,.28)] transition-opacity duration-[120ms] group-hover:opacity-100 group-active:opacity-20 group-disabled:opacity-0 motion-reduce:transition-none"
        data-metal-layer="outer-shadow"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] z-10 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,211,125,.20),transparent_44%),linear-gradient(180deg,#332819_0%,#17120d_50%,#090807_100%)] shadow-[inset_0_7px_12px_rgba(255,210,126,.035),inset_0_-10px_14px_rgba(0,0,0,.72)] transition-[filter] duration-[120ms] group-hover:brightness-[1.18] group-active:brightness-[.72] motion-reduce:transition-none"
        data-metal-layer="surface"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px] z-[15] bg-[repeating-linear-gradient(104deg,transparent_0,transparent_5px,rgba(255,237,196,.035)_6px,transparent_7px),radial-gradient(circle_at_18%_30%,rgba(255,255,255,.06),transparent_2px)] opacity-60 mix-blend-overlay group-active:opacity-25"
        data-metal-layer="surface-texture"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[8px] z-20 border border-[#5d472b]/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,.75),inset_0_3px_8px_rgba(0,0,0,.72)] group-hover:border-[#a77a3d]/90 group-active:shadow-[inset_0_4px_12px_rgba(0,0,0,.92)]"
        data-metal-layer="inner-contour"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[11px] top-[6px] z-20 h-px bg-[linear-gradient(90deg,transparent,rgba(255,237,188,.5),transparent)] opacity-55 group-hover:opacity-100 group-active:opacity-25"
        data-metal-layer="edge-highlight"
      />
      <GameButtonFrame variant="gold" />
      <span className="relative z-40 translate-y-[-1px] group-active:translate-y-0">
        {children}
      </span>
    </button>
  );
}
