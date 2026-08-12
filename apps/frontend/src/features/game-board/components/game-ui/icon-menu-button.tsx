import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { GameButtonFrame } from "./game-button-frame.tsx";

export function IconMenuButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "group relative isolate grid size-[46px] shrink-0 place-items-center overflow-visible [clip-path:polygon(6px_0,calc(100%_-_6px)_0,100%_6px,100%_calc(100%_-_6px),calc(100%_-_6px)_100%,6px_100%,0_calc(100%_-_6px),0_6px)] transition-[transform,filter] duration-[120ms] active:translate-y-px active:brightness-[.76] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none",
        className,
      )}
      data-game-button="icon-menu"
      type={type}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] z-0 opacity-0 shadow-[0_0_4px_rgba(255,200,87,.72),0_0_12px_rgba(255,177,56,.26)] transition-opacity group-hover:opacity-100 group-active:opacity-20 group-disabled:opacity-0"
        data-metal-layer="outer-shadow"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] z-10 bg-[radial-gradient(circle_at_50%_-15%,rgba(255,206,113,.11),transparent_48%),linear-gradient(180deg,#15120e,#07090a_58%,#030506)] shadow-[inset_0_-9px_12px_rgba(0,0,0,.78)] group-hover:brightness-[1.16] group-active:brightness-[.68]"
        data-metal-layer="surface"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px] z-[15] bg-[repeating-linear-gradient(104deg,transparent_0,transparent_4px,rgba(255,233,190,.035)_5px,transparent_6px)] opacity-60 mix-blend-overlay group-active:opacity-20"
        data-metal-layer="surface-texture"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[8px] z-20 border border-[#59462f]/75 shadow-[inset_0_3px_8px_rgba(0,0,0,.8)]"
        data-metal-layer="inner-contour"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10px] top-[6px] z-20 h-px bg-[linear-gradient(90deg,transparent,rgba(255,235,187,.45),transparent)] opacity-45 group-hover:opacity-100"
        data-metal-layer="edge-highlight"
      />
      <GameButtonFrame variant="gold" />
      <span
        aria-hidden="true"
        className="relative z-40 flex flex-col gap-[4px]"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <span
            className="size-[4px] rounded-full bg-[#e5e0d8] shadow-[0_0_3px_rgba(255,255,255,.28)]"
            data-menu-dot="true"
            key={index}
          />
        ))}
      </span>
    </button>
  );
}
