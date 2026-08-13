import { useId } from "react";

interface DisastarLogoProps {
  /** ロゴ全体の幅。親要素でのレイアウト指定より優先する場合だけ指定する。 */
  width?: string | number;
  className?: string;
  /** 装飾アニメーションを有効にする。OSの動きを減らす設定は常に優先する。 */
  animated?: boolean;
  primaryColor?: string;
  accentColorCyan?: string;
  accentColorGold?: string;
}

/**
 * 添付デザインをそのまま画面サイズに応じて縮小できる、DISASTAR用のSVGロゴ。
 * SVGのIDとアニメーション名はインスタンスごとに分離し、複数表示時の衝突を防ぐ。
 */
export function DisastarLogo({
  width = "100%",
  className = "",
  animated = true,
  primaryColor = "#ffffff",
  accentColorCyan = "#4fa8d1",
  accentColorGold = "#dcb36d",
}: DisastarLogoProps) {
  const instanceId = useId().replaceAll(/[^a-zA-Z0-9_-]/g, "");
  const prefix = `disastar-logo-${instanceId}`;
  const ids = {
    goldGradient: `${prefix}-gold-gradient`,
    textGradient: `${prefix}-text-gradient`,
    cyanGlow: `${prefix}-cyan-glow`,
    glow: `${prefix}-glow`,
    cyberSlit: `${prefix}-cyber-slit`,
  };
  const animation = (name: string, value: string) =>
    animated ? `animation:${name} ${value};` : "";

  const svgStyles = `
    .${prefix}-title {
      font-family: var(--font-sans), "Arial Black", sans-serif;
      font-weight: 900;
      font-size: 50px;
      letter-spacing: .08em;
      fill: url(#${ids.textGradient});
    }
    .${prefix}-subtitle {
      font-family: var(--font-sans), ui-monospace, monospace;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: .45em;
      fill: #8397af;
    }
    .${prefix}-micro {
      font-family: var(--font-sans), ui-monospace, monospace;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: .15em;
      fill: ${accentColorCyan};
    }
    .${prefix}-warning { fill: ${accentColorGold}; }
    @keyframes ${prefix}-spin { to { transform: rotate(360deg); } }
    @keyframes ${prefix}-spin-reverse { to { transform: rotate(-360deg); } }
    @keyframes ${prefix}-blink {
      0%, 100% { opacity: .3; }
      50% { opacity: 1; }
    }
    @keyframes ${prefix}-radar-ping {
      0% { r: 10; opacity: .8; stroke-width: 2; }
      100% { r: 45; opacity: 0; stroke-width: .5; }
    }
    @keyframes ${prefix}-data-flow { to { stroke-dashoffset: -40; } }
    .${prefix}-spin-slow {
      transform-origin: 70px 70px;
      ${animation(`${prefix}-spin`, "40s linear infinite")}
    }
    .${prefix}-spin-fast-rev {
      transform-origin: 70px 70px;
      ${animation(`${prefix}-spin-reverse`, "15s linear infinite")}
    }
    .${prefix}-blink-fast { ${animation(`${prefix}-blink`, ".8s ease-in-out infinite")} }
    .${prefix}-blink-slow { ${animation(`${prefix}-blink`, "3s ease-in-out infinite")} }
    .${prefix}-ping-wave {
      transform-origin: 70px 70px;
      ${animation(`${prefix}-radar-ping`, "2.5s cubic-bezier(.1,.7,1,.1) infinite")}
    }
    .${prefix}-flow-line { ${animation(`${prefix}-data-flow`, "1.5s linear infinite")} }
    @media (prefers-reduced-motion: reduce) {
      .${prefix}-spin-slow,
      .${prefix}-spin-fast-rev,
      .${prefix}-blink-fast,
      .${prefix}-blink-slow,
      .${prefix}-ping-wave,
      .${prefix}-flow-line { animation: none !important; }
    }
  `;

  return (
    <div
      aria-label="DISASTAR Emergency Protocol"
      className={`relative inline-block ${className}`}
      data-disastar-logo="true"
      role="img"
      style={{ width }}
    >
      <svg
        aria-hidden="true"
        className="block h-auto w-full drop-shadow-[0_5px_10px_rgba(0,0,0,.75)]"
        focusable="false"
        viewBox="0 0 580 140"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <style>{svgStyles}</style>
          <linearGradient
            id={ids.goldGradient}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#fff1c5" />
            <stop offset="40%" stopColor={accentColorGold} />
            <stop offset="100%" stopColor="#7a5518" />
          </linearGradient>
          <linearGradient
            id={ids.textGradient}
            x1="0%"
            x2="0%"
            y1="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id={ids.cyanGlow} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(79, 168, 209, 0)" />
            <stop offset="50%" stopColor="rgba(79, 168, 209, .5)" />
            <stop offset="100%" stopColor="rgba(79, 168, 209, 0)" />
          </linearGradient>
          <filter id={ids.glow} height="140%" width="140%" x="-20%" y="-20%">
            <feGaussianBlur result="blur" stdDeviation="4" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <mask id={ids.cyberSlit}>
            <rect fill="white" height="100%" width="100%" x="0" y="0" />
            <path d="M 140 82 L 550 82 L 560 78 L 150 78 Z" fill="black" />
            <path d="M 140 88 L 450 88 L 455 86 L 145 86 Z" fill="black" />
          </mask>
        </defs>

        <g transform="translate(10, 0)">
          <path
            d="M70 15 L118 42.5 L118 97.5 L70 125 L22 97.5 L22 42.5 Z"
            fill="none"
            stroke="#1c2d42"
            strokeWidth="1.5"
          />
          <circle
            className={`${prefix}-ping-wave`}
            cx="70"
            cy="70"
            fill="none"
            r="10"
            stroke={accentColorCyan}
          />
          <g className={`${prefix}-spin-slow`}>
            <circle
              cx="70"
              cy="70"
              fill="none"
              opacity=".7"
              r="38"
              stroke={`url(#${ids.goldGradient})`}
              strokeDasharray="60 10 10 10 30 10"
              strokeWidth="1.5"
            />
            <circle
              cx="70"
              cy="70"
              fill="none"
              r="42"
              stroke={accentColorCyan}
              strokeDasharray="2 4"
              strokeWidth=".5"
            />
            <path d="M 70 20 L 75 25 L 65 25 Z" fill={accentColorGold} />
            <path d="M 70 120 L 75 115 L 65 115 Z" fill={accentColorGold} />
            <path d="M 20 70 L 25 65 L 25 75 Z" fill={accentColorCyan} />
            <path d="M 120 70 L 115 65 L 115 75 Z" fill={accentColorCyan} />
          </g>
          <g className={`${prefix}-spin-fast-rev`}>
            <circle
              cx="70"
              cy="70"
              fill="none"
              opacity=".9"
              r="28"
              stroke={accentColorCyan}
              strokeDasharray="10 30 20 15"
              strokeWidth="2"
            />
            <path d="M 70 38 L 72 45 L 68 45 Z" fill={accentColorCyan} />
          </g>
          <path
            d="M70 40 L78 60 L98 64 L78 72 L70 92 L62 72 L42 64 L62 60 Z"
            fill={`url(#${ids.goldGradient})`}
            filter={`url(#${ids.glow})`}
          />
          <path
            d="M70 48 L74 62 L88 64 L74 68 L70 82 L66 68 L52 64 L66 62 Z"
            fill="#0b111a"
          />
          <circle
            className={`${prefix}-blink-fast`}
            cx="70"
            cy="64"
            fill="#fff"
            filter={`url(#${ids.glow})`}
            r="3"
          />
        </g>

        <g transform="translate(150, 0)">
          <path
            d="M -10 35 L 420 35"
            fill="none"
            stroke={`url(#${ids.cyanGlow})`}
            strokeWidth="1"
          />
          <path
            d="M -10 108 L 15 108 L 25 118 L 420 118"
            fill="none"
            stroke="#2a3f5a"
            strokeWidth="1.5"
          />
          <g transform="translate(-10, 25)">
            <rect
              fill={accentColorGold}
              height="10"
              opacity=".8"
              width="4"
              x="0"
              y="0"
            />
            <rect
              fill={accentColorCyan}
              height="10"
              opacity=".5"
              width="2"
              x="6"
              y="0"
            />
            <rect
              fill={accentColorCyan}
              height="10"
              opacity=".3"
              width="2"
              x="10"
              y="0"
            />
          </g>
          <text
            className={`${prefix}-micro ${prefix}-blink-slow`}
            x="25"
            y="28"
          >
            [ LINK ESTABLISHED ]
          </text>
          <text className={`${prefix}-micro`} opacity=".6" x="160" y="28">
            NET.SEC: OMEGA // AUTH: VERIFIED
          </text>
          <text
            className={`${prefix}-micro ${prefix}-warning ${prefix}-blink-fast`}
            x="340"
            y="28"
          >
            SYS_READY
          </text>
          <g mask={`url(#${ids.cyberSlit})`}>
            <text
              className={`${prefix}-title`}
              filter="drop-shadow(0px 6px 10px rgba(0,0,0,.9))"
              x="0"
              y="80"
            >
              DISASTAR
            </text>
          </g>
          <text
            className={`${prefix}-title`}
            fill="none"
            opacity=".5"
            stroke="rgba(255,255,255,.2)"
            strokeWidth=".5"
            x="0"
            y="80"
          >
            DISASTAR
          </text>
          <rect
            fill="rgba(79, 168, 209, .05)"
            height="18"
            width="230"
            x="2"
            y="98"
          />
          <text className={`${prefix}-subtitle`} x="10" y="111">
            EMERGENCY PROTOCOL
          </text>
          <g transform="translate(250, 102)">
            <rect fill={accentColorGold} height="4" width="12" x="0" y="0" />
            <rect
              fill={accentColorCyan}
              height="4"
              opacity=".4"
              width="25"
              x="15"
              y="0"
            />
            <line
              className={`${prefix}-flow-line`}
              stroke={accentColorCyan}
              strokeDasharray="4 8"
              strokeWidth="1.5"
              x1="45"
              x2="160"
              y1="2"
              y2="2"
            />
          </g>
          <g transform="translate(390, 110) skewX(-45)">
            <rect
              fill={accentColorGold}
              height="8"
              opacity=".7"
              width="4"
              x="0"
              y="0"
            />
            <rect
              fill={accentColorGold}
              height="8"
              opacity=".7"
              width="4"
              x="6"
              y="0"
            />
            <rect
              fill={accentColorGold}
              height="8"
              opacity=".7"
              width="4"
              x="12"
              y="0"
            />
          </g>
          <rect
            fill={accentColorCyan}
            height="55"
            opacity=".4"
            width="2"
            x="-10"
            y="45"
          />
          <rect fill={accentColorGold} height="10" width="6" x="-12" y="45">
            {animated ? (
              <animate
                attributeName="y"
                dur="4s"
                repeatCount="indefinite"
                values="45; 90; 45"
              />
            ) : null}
          </rect>
        </g>
      </svg>
    </div>
  );
}
