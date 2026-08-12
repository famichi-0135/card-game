import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { GameButtonFrame } from "./game-button-frame.tsx";

export function SecondaryGameButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "group relative isolate flex h-[38px] min-w-[118px] items-center justify-center overflow-visible px-[15px] font-['Noto_Sans_JP','Yu_Gothic_UI',sans-serif] text-[12px] font-medium tracking-[.07em] text-[#cfe8fa] [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_6px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,6px_100%,0_calc(100%_-_6px),0_6px)] [text-shadow:0_1px_1px_#000,0_0_7px_rgba(89,175,232,.16)] transition-[transform,filter] duration-[120ms] hover:text-[#eaf7ff] active:translate-y-px active:brightness-[.82] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none",
        className,
      )}
      data-game-button="secondary"
      type={type}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] z-0 opacity-0 shadow-[0_0_4px_rgba(74,139,255,.66),0_0_12px_rgba(50,153,220,.25)] transition-opacity duration-[120ms] group-hover:opacity-100 group-active:opacity-20 group-disabled:opacity-0 motion-reduce:transition-none"
        data-metal-layer="outer-shadow"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] z-10 bg-[radial-gradient(circle_at_50%_-20%,rgba(70,157,214,.16),transparent_48%),linear-gradient(180deg,#102333_0%,#08131b_50%,#04080c_100%)] shadow-[inset_0_6px_10px_rgba(123,204,255,.025),inset_0_-10px_14px_rgba(0,0,0,.76)] transition-[filter] duration-[120ms] group-hover:brightness-[1.2] group-active:brightness-[.7] motion-reduce:transition-none"
        data-metal-layer="surface"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px] z-[15] bg-[repeating-linear-gradient(104deg,transparent_0,transparent_5px,rgba(185,226,248,.03)_6px,transparent_7px),radial-gradient(circle_at_72%_28%,rgba(255,255,255,.05),transparent_2px)] opacity-55 mix-blend-overlay group-active:opacity-20"
        data-metal-layer="surface-texture"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[8px] z-20 border border-[#21496a]/85 shadow-[inset_0_0_0_1px_rgba(0,0,0,.78),inset_0_3px_8px_rgba(0,0,0,.78)] group-hover:border-[#4d91c2] group-active:shadow-[inset_0_4px_12px_rgba(0,0,0,.94)]"
        data-metal-layer="inner-contour"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10px] top-[6px] z-20 h-px bg-[linear-gradient(90deg,transparent,rgba(176,225,255,.48),transparent)] opacity-45 group-hover:opacity-100 group-active:opacity-20"
        data-metal-layer="edge-highlight"
      />
      <GameButtonFrame variant="blue" />
      <span className="relative z-40 translate-y-[-1px] group-active:translate-y-0">
        {children}
      </span>
    </button>
  );
}
