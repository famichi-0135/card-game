import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { AccountMenu } from "../features/account/account-menu.tsx";
import { DisastarLogo } from "./disastar-logo.tsx";

const HIDE_SCROLL_THRESHOLD = 48;

// ヘッダーと全ページ本文が同じ左右の基準線を共有するための外側フレーム。
// 1540px は実コンテンツ幅、1596px は左右 28px のデスクトップ余白を含む幅。
export const appPageFrameClassName =
  "mx-auto w-full max-w-[1596px] px-4 sm:px-7";

export function shouldHideAppHeader({
  currentY,
  previousY,
}: {
  currentY: number;
  previousY: number;
}): boolean {
  return currentY > HIDE_SCROLL_THRESHOLD && currentY > previousY;
}

export function getAppHeaderTransform(isHidden: boolean): string {
  return isHidden ? "translateY(calc(-100% - 4rem))" : "translateY(0)";
}

export function AppHeader({ rightSlot }: { rightSlot?: ReactNode }) {
  const location = useLocation();
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;
    let frameId: number | null = null;

    function updateHeaderVisibility() {
      frameId = null;
      const currentY = window.scrollY;
      setIsHidden(shouldHideAppHeader({ currentY, previousY }));
      previousY = currentY;
    }

    function onScroll() {
      if (frameId === null) {
        frameId = window.requestAnimationFrame(updateHeaderVisibility);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    setIsHidden(false);
  }, [location.pathname]);

  return (
    <header
      className={`sticky top-4 z-50 ${appPageFrameClassName} transition-transform duration-200 motion-reduce:transition-none sm:top-5`}
      data-app-header="true"
      style={{ transform: getAppHeaderTransform(isHidden) }}
    >
      <div
        className="relative flex min-h-[76px] w-full flex-wrap items-center justify-between gap-x-5 overflow-hidden border border-[#2b3c49]/90 bg-[linear-gradient(105deg,rgba(6,15,22,.98),rgba(10,24,34,.96)_55%,rgba(7,17,25,.98))] px-4 shadow-[0_14px_35px_rgba(0,0,0,.38),inset_0_1px_0_rgba(237,247,255,.11),inset_0_0_0_1px_rgba(0,0,0,.58)] before:pointer-events-none before:absolute before:inset-[3px] before:border before:border-white/[.045] after:pointer-events-none after:absolute after:inset-x-10 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(214,174,90,.75),transparent)] [clip-path:polygon(10px_0,calc(100%-10px)_0,100%_10px,100%_calc(100%-10px),calc(100%-10px)_100%,10px_100%,0_calc(100%-10px),0_10px)] sm:px-7"
        data-app-header-island="true"
      >
        <Link
          aria-label="DISASTAR CARD GAME ホーム"
          className="flex w-[218px] shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3ac59] sm:w-[260px]"
          to="/"
        >
          <DisastarLogo />
        </Link>
        <nav
          aria-label="主要ナビゲーション"
          className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm text-[#9daeba] md:order-none md:w-auto"
        >
          <AppHeaderLink currentPath={location.pathname} to="/">
            ホーム
          </AppHeaderLink>
          <AppHeaderLink currentPath={location.pathname} to="/learn">
            防災情報
          </AppHeaderLink>
          <AppHeaderLink currentPath={location.pathname} to="/rule">
            遊び方
          </AppHeaderLink>
          <AppHeaderLink currentPath={location.pathname} to="/mypage">
            マイページ
          </AppHeaderLink>
        </nav>
        <div className="flex items-center gap-3">
          {rightSlot === undefined ? <AccountMenu /> : rightSlot}
        </div>
      </div>
    </header>
  );
}

function AppHeaderLink({
  children,
  currentPath,
  to,
}: {
  children: string;
  currentPath: string;
  to: string;
}) {
  const isActive =
    to === "/" ? currentPath === "/" : currentPath.startsWith(to);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`border-b-2 px-3 py-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced] ${
        isActive
          ? "border-[#d1aa59] font-medium text-[#f1d38e]"
          : "border-transparent hover:text-[#e5eef3]"
      }`}
      to={to}
    >
      {children}
    </Link>
  );
}
