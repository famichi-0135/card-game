import type { ReactNode } from "react";
import {
  AppPanel,
  AppShell,
  PageHeader,
} from "../../components/application-ui.tsx";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AppShell contentClassName="flex min-h-[calc(100dvh-76px)] items-center justify-center py-12">
      <AppPanel className="w-full max-w-md p-6 sm:p-7" label="ACCOUNT ACCESS">
        <PageHeader
          description={description}
          eyebrow="DISASTAR ACCOUNT"
          title={title}
        />
        <div className="mt-7">{children}</div>
      </AppPanel>
    </AppShell>
  );
}

export function AuthStatus({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "error" | "success";
}) {
  const toneClassName =
    tone === "error"
      ? "border-[#803c42] bg-[#32151b]/85 text-[#ffb8b8]"
      : tone === "success"
        ? "border-[#3f7450] bg-[#10271a]/85 text-[#b9e7c4]"
        : "border-[#2f4a5e] bg-[#071018]/85 text-[#b9cad4]";

  return (
    <p className={`border px-3 py-2 text-sm ${toneClassName}`} role="status">
      {children}
    </p>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#c9d8e0]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const authInputClassName =
  "h-11 border border-[#2f4a5e] bg-[#050d13]/90 px-3 text-base text-[#edf5f9] outline-none placeholder:text-[#506776] shadow-[inset_0_1px_0_rgba(255,255,255,.035)] focus:border-[#72b8e5] focus:ring-2 focus:ring-[#3b86b6]/25";

export const authPrimaryButtonClassName =
  "inline-flex h-11 items-center justify-center border border-[#b98d3f] bg-[radial-gradient(circle_at_20%_0%,rgba(255,224,137,.18),transparent_48%),linear-gradient(180deg,rgba(101,74,30,.95),rgba(47,34,17,.98))] px-4 text-sm font-medium tracking-[.05em] text-[#fff0c9] shadow-[inset_0_1px_0_rgba(255,242,202,.25),inset_0_0_0_1px_rgba(39,25,10,.7)] transition hover:border-[#f3c968] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#eac46c]";

export const authLinkClassName =
  "text-sm font-medium text-[#bcdcf0] underline decoration-[#487694] underline-offset-4 hover:text-[#e8f6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]";
