import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * DISASTAR のカード裏面。
 * 金属の二重フレーム、コーナー装飾、中央のコンパスエンブレムを
 * SVG とグラデーションで構成した再利用可能な部品。
 */
export function CardBack({
  className,
  concealed = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { concealed?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate overflow-hidden bg-[linear-gradient(158deg,#1a2025_0%,#0c1013_42%,#07090b_100%)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.9),inset_0_0_22px_rgba(0,0,0,.86),0_3px_10px_rgba(0,0,0,.55)] [clip-path:polygon(7px_0,calc(100%_-_7px)_0,100%_7px,100%_calc(100%_-_7px),calc(100%_-_7px)_100%,7px_100%,0_calc(100%_-_7px),0_7px)]",
        className,
      )}
      data-card-back="disastar"
      {...props}
    >
      {/* 石 / 金属の面テクスチャ */}
      <span
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_32%_22%,rgba(148,163,170,.07),transparent_46%),radial-gradient(circle_at_74%_82%,rgba(148,163,170,.05),transparent_42%),repeating-linear-gradient(97deg,rgba(255,255,255,.016)_0,rgba(255,255,255,.016)_1px,transparent_1px,transparent_6px),repeating-linear-gradient(0deg,rgba(255,255,255,.014)_0,rgba(255,255,255,.014)_1px,transparent_1px,transparent_4px)]"
        data-card-back-layer="texture"
      />
      {/* 中央の淡い円環パターン */}
      <span
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_44%,transparent_30%,rgba(177,158,116,.05)_31%,transparent_33%,transparent_38%,rgba(177,158,116,.04)_39%,transparent_41%)]"
        data-card-back-layer="ring-pattern"
      />
      <CardBackFrame />
      {concealed ? (
        <span
          className="absolute inset-0 z-[2] grid place-items-center font-mono text-[26px] font-medium text-[#6f7b7a] [text-shadow:0_1px_2px_#000,0_0_10px_rgba(126,140,138,.3)]"
          data-card-back-face="concealed"
        >
          ?
        </span>
      ) : (
        <span
          className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-[6%]"
          data-card-back-face="emblem"
        >
          <CardBackEmblem className="aspect-square w-[52%] max-w-[110px]" />
          <span className="flex flex-col items-center gap-[2px] text-center">
            <span className="font-serif text-[11px] font-semibold tracking-[.32em] text-[#a8987a] [text-shadow:0_1px_1px_#000,0_-1px_1px_rgba(255,244,214,.14)]">
              DISASTAR
            </span>
            <span className="text-[6px] tracking-[.48em] text-[#6d6350]">
              emergency
            </span>
          </span>
        </span>
      )}
    </div>
  );
}

function CardBackFrame() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[3] size-full"
      data-card-back-frame="svg"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {/* 外周の黒い溝と真鍮のアウトライン */}
      <path
        d="M1 1H99V99H1Z"
        fill="none"
        stroke="#010203"
        strokeWidth="4.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.5 1.5H98.5V98.5H1.5Z"
        fill="none"
        stroke="#7d6a4a"
        strokeOpacity=".85"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      {/* 内側の溝と細いインナーライン */}
      <path
        d="M3.4 3.4H96.6V96.6H3.4Z"
        fill="none"
        stroke="#000"
        strokeOpacity=".92"
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4.6 4.6H95.4V95.4H4.6Z"
        fill="none"
        stroke="#a89372"
        strokeOpacity=".34"
        strokeWidth=".7"
        vectorEffect="non-scaling-stroke"
      />
      {/* 上辺のハイライトと下辺の落ち影 */}
      <path
        d="M8 2.6H92"
        fill="none"
        stroke="#fff"
        strokeOpacity=".16"
        strokeWidth=".7"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8 97.6H92"
        fill="none"
        stroke="#000"
        strokeOpacity=".8"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {/* 四隅のブラケット装飾 */}
      <path
        d="M6.5 15V8L8.5 6.5H15M85 6.5H91.5L93.5 8V15M93.5 85V92L91.5 93.5H85M15 93.5H8.5L6.5 92V85"
        fill="none"
        stroke="#b39c72"
        strokeOpacity=".66"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M9 12V10L10 9H12M88 9H90L91 10V12M91 88V90L90 91H88M12 91H10L9 90V88"
        fill="none"
        stroke="#fff"
        strokeOpacity=".2"
        strokeWidth=".6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CardBackEmblem({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("block", className)}
      data-card-back-emblem="compass"
      focusable="false"
      viewBox="0 0 120 120"
    >
      {/* ハローと二重円 */}
      <circle cx="60" cy="60" fill="none" r="55" stroke="#b19e74" strokeOpacity=".1" strokeWidth="5" />
      <circle cx="60" cy="60" fill="none" r="46" stroke="#9c8b66" strokeOpacity=".6" strokeWidth="1.4" />
      <circle cx="60" cy="60" fill="none" r="41.5" stroke="#9c8b66" strokeOpacity=".3" strokeWidth=".7" />
      {/* 四方位のダイヤマーカー */}
      <path
        d="M60 4L63 8.5L60 13L57 8.5ZM60 107L63 111.5L60 116L57 111.5ZM4 60L8.5 57L13 60L8.5 63ZM107 60L111.5 57L116 60L111.5 63Z"
        fill="#0a0d10"
        stroke="#a8987a"
        strokeOpacity=".75"
      />
      {/* 方位星（四方位の長い光条） */}
      <path
        d="M60 12L66 54L108 60L66 66L60 108L54 66L12 60L54 54Z"
        fill="rgba(168,152,122,.12)"
        stroke="#b3a07a"
        strokeOpacity=".85"
        strokeWidth="1"
      />
      {/* 斜め方位の短い光条 */}
      <path
        d="M84 36L66 54L84 84L66 66L36 84L54 66L36 36L54 54Z"
        fill="none"
        stroke="#9c8b66"
        strokeOpacity=".5"
        strokeWidth=".8"
      />
      {/* 中心 */}
      <circle cx="60" cy="60" fill="#0a0d10" r="9.5" stroke="#a8987a" strokeOpacity=".8" />
      <path d="M60 54.5L65.5 60L60 65.5L54.5 60Z" fill="#a8987a" fillOpacity=".8" />
    </svg>
  );
}
