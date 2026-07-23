import type { ReactNode } from "react";

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
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">
          DISASTAR CARD GAME
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
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
      ? "border-red-300 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-slate-300 bg-slate-50 text-slate-700";

  return (
    <p
      className={`rounded border px-3 py-2 text-sm ${toneClassName}`}
      role="status"
    >
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
    <label className="grid gap-1.5 text-sm font-medium text-slate-800">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const authInputClassName =
  "h-10 rounded border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-200";

export const authPrimaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

export const authLinkClassName =
  "text-sm font-medium text-slate-800 underline underline-offset-4 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";
