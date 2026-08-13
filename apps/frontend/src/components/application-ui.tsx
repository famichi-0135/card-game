import { type ReactNode } from "react";
import { AppHeader, appPageFrameClassName } from "./app-header.tsx";
import { cn } from "@/lib/utils";

export const appButtonClassName = {
  danger:
    "inline-flex h-11 items-center justify-center border border-[#803c42] bg-[linear-gradient(180deg,rgba(86,30,35,.96),rgba(43,15,20,.98))] px-4 text-sm font-medium tracking-[.05em] text-[#ffd8d8] shadow-[inset_0_1px_0_rgba(255,218,218,.1)] transition hover:border-[#df7078] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#df7078]",
  primary:
    "inline-flex h-11 items-center justify-center border border-[#b98d3f] bg-[radial-gradient(circle_at_20%_0%,rgba(255,224,137,.18),transparent_48%),linear-gradient(180deg,rgba(101,74,30,.95),rgba(47,34,17,.98))] px-4 text-sm font-medium tracking-[.05em] text-[#fff0c9] shadow-[inset_0_1px_0_rgba(255,242,202,.25),inset_0_0_0_1px_rgba(39,25,10,.7)] transition hover:border-[#f3c968] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#eac46c]",
  secondary:
    "inline-flex h-11 items-center justify-center border border-[#315b7e] bg-[linear-gradient(180deg,rgba(19,45,66,.96),rgba(6,16,25,.98))] px-4 text-sm font-medium tracking-[.05em] text-[#d8efff] shadow-[inset_0_1px_0_rgba(214,240,255,.12)] transition hover:border-[#76bcec] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#7ac4f3]",
  tertiary:
    "inline-flex h-11 items-center justify-center border border-[#334752] bg-[#08131b]/80 px-4 text-sm font-medium tracking-[.04em] text-[#bed0da] transition hover:border-[#637e8d] hover:bg-[#10212c] hover:text-[#eef8ff] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#75bced]",
} as const;

export const appInputClassName =
  "h-11 w-full border border-[#2f4a5e] bg-[#050d13]/90 px-3 text-[15px] text-[#edf5f9] outline-none placeholder:text-[#506776] shadow-[inset_0_1px_0_rgba(255,255,255,.035)] transition focus:border-[#72b8e5] focus:ring-2 focus:ring-[#3b86b6]/25 disabled:cursor-not-allowed disabled:opacity-50";

export function AppShell({
  children,
  className,
  contentClassName,
  includeAccountMenu = true,
  headerRightSlot,
}: {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  includeAccountMenu?: boolean;
  headerRightSlot?: ReactNode;
}) {
  return (
    <main
      className={cn(
        "relative min-h-dvh overflow-x-clip bg-[#03080c] text-[#e6eff4]",
        className,
      )}
      data-application-shell="true"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_52%_10%,rgba(20,56,81,.22),transparent_42%),radial-gradient(ellipse_at_4%_90%,rgba(9,43,63,.17),transparent_36%),linear-gradient(180deg,rgba(3,9,13,.25),rgba(0,3,6,.9)),repeating-linear-gradient(0deg,transparent_0,transparent_47px,rgba(102,147,176,.03)_48px),repeating-linear-gradient(90deg,transparent_0,transparent_47px,rgba(102,147,176,.025)_48px)]"
      />
      <div className="relative">
        <AppHeader
          rightSlot={
            headerRightSlot === undefined
              ? includeAccountMenu
                ? undefined
                : null
              : headerRightSlot
          }
        />
        <div
          className={cn(
            `${appPageFrameClassName} py-10 sm:py-14`,
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export function PageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-[#2a3d4b]/90 pb-8 [box-shadow:0_1px_0_rgba(224,244,255,.04)]">
      <div className="max-w-3xl">
        <p className="text-[11px] font-medium tracking-[.2em] text-[#5798c9]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.12] tracking-[-.04em] text-[#edf3f7]">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#9aabb8]">
            {description}
          </p>
        )}
      </div>
      {action === undefined ? null : <div>{action}</div>}
    </header>
  );
}

export function AppPanel({
  children,
  className,
  label,
}: {
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      className={cn(
        "relative border border-[#2a3d4b] bg-[radial-gradient(circle_at_80%_0%,rgba(57,112,148,.11),transparent_36%),linear-gradient(145deg,rgba(12,24,33,.96),rgba(3,10,15,.98))] p-5 shadow-[inset_0_1px_0_rgba(231,246,255,.08),inset_0_0_36px_rgba(0,0,0,.42),0_20px_45px_rgba(0,0,0,.18)] before:pointer-events-none before:absolute before:inset-[4px] before:border before:border-white/[.035] sm:p-6",
        className,
      )}
      data-application-panel="true"
    >
      {label === undefined ? null : (
        <p className="relative mb-4 text-[10px] font-medium tracking-[.18em] text-[#608eaa]">
          {label}
        </p>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

export function AppEmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <AppPanel className="text-center" label="STATUS">
      <h2 className="text-lg font-semibold text-[#e5eef3]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#91a5b4]">
        {description}
      </p>
      {action === undefined ? null : <div className="mt-5">{action}</div>}
    </AppPanel>
  );
}
