"use client";

import type { ReactNode } from "react";
import { MiniSpinner } from "./MobileLoaders";

export function MobileLoadingList({ label = "Loading courses…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="grid gap-3">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="animate-pulse rounded-3xl border border-app-border bg-app-surface p-5"
        >
          <div className="h-3 w-24 rounded-full bg-app-surface-2" />
          <div className="mt-3 h-5 w-3/4 rounded-full bg-app-surface-2" />
          <div className="mt-3 h-3 w-full rounded-full bg-app-surface-2" />
          <div className="mt-2 h-3 w-5/6 rounded-full bg-app-surface-2" />
          <div className="mt-4 h-11 w-full rounded-full bg-app-surface-2" />
        </div>
      ))}
    </div>
  );
}

export function MobileStateCard({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <section
      role={title.toLowerCase().includes("unavailable") || title.toLowerCase().includes("error") ? "alert" : "status"}
      className="rounded-3xl border border-app-border bg-app-surface p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
    >
      <p aria-hidden="true" className="text-3xl">
        {icon ?? "📱"}
      </p>
      <h2 className="mt-3 text-lg font-black text-app-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-app-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}

export function MobileRetryButton({
  onRetry,
  label = "Try again",
  busy = false,
}: {
  onRetry: () => void;
  label?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={busy}
      aria-busy={busy}
      className="focus-ring inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {busy ? <MiniSpinner /> : null}
      <span>{busy ? `${label}…` : label}</span>
    </button>
  );
}
