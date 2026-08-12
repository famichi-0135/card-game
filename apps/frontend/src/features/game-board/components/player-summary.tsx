import type { PlayerGameView } from "@disastar/game-engine";
import type { ReactNode } from "react";
import { GameFrame } from "./game-ui/index.ts";

type BoardPlayer = PlayerGameView["self"] | PlayerGameView["opponent"];

export function PlayerSummary({
  player,
  label,
  status,
}: {
  player: BoardPlayer;
  label: string;
  status?: ReactNode;
}) {
  return (
    <GameFrame
      as="section"
      aria-label={`${label}のステータス`}
      className="flex min-h-0 flex-col justify-between p-[14px] text-[#dbe3e5]"
      variant={label === "相手" ? "red" : "blue"}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-medium tracking-[.12em] text-[#8ca2ab]">
            {label === "相手" ? "OPPONENT" : "PLAYER"}
          </p>
          <h2 className="mt-[3px] text-[19px] font-semibold tracking-[.08em]">
            {label}
          </h2>
        </div>
        {status === undefined ? null : (
          <div className="border border-white/[.12] bg-black/30 px-[6px] py-[3px] text-right text-[9px] text-[#b9c7cc]">
            {status}
          </div>
        )}
      </div>
      <div className="relative z-10 my-[8px] flex items-end justify-between border-y border-white/[.1] py-[10px]">
        <span className="text-[10px] tracking-[.12em] text-[#9eb0b7]">
          STAMINA
        </span>
        <strong className="font-mono text-[31px] leading-none tabular-nums text-[#f3d58e]">
          {player.stamina}
        </strong>
      </div>
      <dl className="relative z-10 grid grid-cols-2 gap-[6px] text-center text-sm">
        <div className="border-r border-white/[.1]">
          <dt className="text-[8px] tracking-[.1em] text-[#83979f]">DECK</dt>
          <dd className="mt-[2px] font-mono text-[14px] text-[#e3ebed]">
            {player.deckCount}
          </dd>
        </div>
        <div>
          <dt className="text-[8px] tracking-[.1em] text-[#83979f]">HAND</dt>
          <dd className="mt-[2px] font-mono text-[14px] text-[#e3ebed]">
            {player.handCount}
          </dd>
        </div>
      </dl>
    </GameFrame>
  );
}
