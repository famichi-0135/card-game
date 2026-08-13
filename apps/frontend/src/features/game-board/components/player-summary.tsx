import type { PlayerGameView } from "@disastar/game-engine";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GameFrame } from "./game-ui/index.ts";

type BoardPlayer = PlayerGameView["self"] | PlayerGameView["opponent"];

const INITIAL_STAMINA = 25;

const palette = {
  blue: {
    accent: "#5a9bff",
    backlight: "rgba(74,139,255,.32)",
    chipBorder: "border-[#3d6ea6]/70",
    gauge: "bg-[#4a8bff]",
    gaugeGlow: "shadow-[0_0_4px_rgba(74,139,255,.55)]",
    label: "text-[#8fb8e8]",
    rim: "#4a8bff",
  },
  red: {
    accent: "#e24a4a",
    backlight: "rgba(226,74,74,.3)",
    chipBorder: "border-[#a63d3d]/70",
    gauge: "bg-[#d8473f]",
    gaugeGlow: "shadow-[0_0_4px_rgba(226,74,74,.55)]",
    label: "text-[#e89a92]",
    rim: "#e24a4a",
  },
} as const;

export function PlayerSummary({
  player,
  label,
  status,
}: {
  player: BoardPlayer;
  label: string;
  status?: ReactNode;
}) {
  const tone = label === "相手" ? palette.red : palette.blue;
  const filledSegments = Math.max(
    0,
    Math.min(INITIAL_STAMINA, player.stamina),
  );

  return (
    <GameFrame
      as="section"
      aria-label={`${label}のステータス`}
      className="flex min-h-0 flex-col p-[11px] text-[#dbe3e5]"
      data-player-panel={label === "相手" ? "opponent" : "self"}
      variant={label === "相手" ? "red" : "blue"}
    >
      {/* ヘッダ: プレイヤーラベルと状態チップ */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <h2
          className={cn(
            "flex items-center gap-[6px] text-[15px] font-semibold tracking-[.14em]",
            tone.label,
          )}
        >
          <span aria-hidden="true" className="text-[9px]">
            ◆
          </span>
          {label}
        </h2>
        {status === undefined ? null : (
          <div
            className={cn(
              "border bg-black/45 px-[6px] py-[2px] text-[8px] tracking-[.06em] text-[#b9c7cc]",
              tone.chipBorder,
            )}
          >
            {status}
          </div>
        )}
      </div>

      {/* 人物シルエットのポートレート */}
      <div className="relative z-10 mx-[2px] mt-[7px] min-h-0 flex-1 overflow-hidden border border-white/[.09] bg-[linear-gradient(180deg,#0b1014,#05080a)] shadow-[inset_0_0_18px_rgba(0,0,0,.85)]">
        <PlayerPortrait
          accent={tone.accent}
          backlight={tone.backlight}
          rim={tone.rim}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.02)_0,rgba(255,255,255,.02)_1px,transparent_1px,transparent_3px)]"
        />
        <PortraitCorners accent={tone.accent} />
      </div>

      {/* STAMINA とセグメントゲージ */}
      <div className="relative z-10 mt-[8px]">
        <div className="flex items-end justify-between">
          <span className="text-[9px] tracking-[.18em] text-[#9eb0b7]">
            STAMINA
          </span>
          <strong className="font-mono text-[26px] leading-none tabular-nums text-[#f4f6f5] [text-shadow:0_0_10px_rgba(255,255,255,.12),0_1px_1px_#000]">
            {player.stamina}
          </strong>
        </div>
        <div
          aria-hidden="true"
          className="mt-[5px] flex gap-[2px]"
          data-stamina-gauge={label === "相手" ? "opponent" : "self"}
        >
          {Array.from({ length: INITIAL_STAMINA }, (_, index) => (
            <span
              className={cn(
                "h-[6px] flex-1 [transform:skewX(-14deg)]",
                index < filledSegments
                  ? cn(tone.gauge, tone.gaugeGlow)
                  : "bg-white/[.07]",
              )}
              key={index}
            />
          ))}
        </div>
      </div>

      {/* HAND / DECK の情報行 */}
      <dl className="relative z-10 mt-[8px] border-t border-white/[.1] text-[11px]">
        <div className="flex items-center justify-between border-b border-white/[.07] py-[4px]">
          <dt className="text-[9px] tracking-[.16em] text-[#83979f]">HAND</dt>
          <dd className="font-mono text-[13px] tabular-nums text-[#e3ebed]">
            {player.handCount}
          </dd>
        </div>
        <div className="flex items-center justify-between py-[4px]">
          <dt className="text-[9px] tracking-[.16em] text-[#83979f]">DECK</dt>
          <dd className="font-mono text-[13px] tabular-nums text-[#e3ebed]">
            {player.deckCount}
          </dd>
        </div>
      </dl>
    </GameFrame>
  );
}

function PlayerPortrait({
  accent,
  backlight,
  rim,
}: {
  accent: string;
  backlight: string;
  rim: string;
}) {
  const gradientId = `portrait-glow-${useId().replaceAll(":", "")}`;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      data-player-portrait="silhouette"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 200 150"
    >
      <defs>
        <radialGradient cx="0.5" cy="0.32" id={gradientId} r="0.75">
          <stop offset="0" stopColor={backlight} />
          <stop offset=".55" stopColor={accent} stopOpacity=".07" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 上部へ寄せた広い環境光 */}
      <rect fill={`url(#${gradientId})`} height="150" width="200" />
      {/* シルエット本体（バスト） */}
      <g transform="translate(14 4) scale(.86)">
        <path
          d="M100 26C86 26 76 38 76 53C76 64 81 73 88 78C66 84 44 101 40 132L40 150H160L160 132C156 101 134 84 112 78C119 73 124 64 124 53C124 38 114 26 100 26Z"
          fill="#060a0f"
          stroke={rim}
          strokeOpacity=".3"
          strokeWidth="1.1"
        />
        {/* 頭部左上と肩口のリムライト */}
        <path
          d="M80 44C83 35 91 29 100 28"
          fill="none"
          stroke={rim}
          strokeOpacity=".85"
          strokeWidth="1.6"
        />
        <path
          d="M45 130C50 105 66 89 86 82"
          fill="none"
          stroke={rim}
          strokeOpacity=".5"
          strokeWidth="1.3"
        />
      </g>
    </svg>
  );
}

function PortraitCorners({ accent }: { accent: string }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path
        d="M3 10V3H10M90 3H97V10M97 90V97H90M10 97H3V90"
        fill="none"
        stroke={accent}
        strokeOpacity=".55"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
