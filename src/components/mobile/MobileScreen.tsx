"use client";

import type { ReactNode } from "react";

export function MobileScreen({
  title,
  eyebrow,
  description,
  children,
  action,
}: {
  /** Optional: screens that already show their name in the top bar can omit it. */
  title?: string;
  /** Optional small label above the title. Omitted pages show a cleaner header. */
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-[16rem] pt-5">
      {eyebrow ? (
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-app-muted">{eyebrow}</p>
      ) : null}
      {title || action ? (
        <div className="mt-1 flex items-start justify-between gap-3">
          {title ? (
            <h1 className="text-2xl font-black leading-tight text-app-text">{title}</h1>
          ) : null}
          {action}
        </div>
      ) : null}
      {description ? <p className="mt-2 text-sm leading-6 text-app-muted">{description}</p> : null}
      {/* grid-cols-1 pins the single column to minmax(0,1fr). A bare `grid`
          sizes the track to the content's min-content width, which lets a
          `truncate` (white-space: nowrap) child push the page wider than the
          screen — that is what made the level cards run off the right edge. */}
      <div className="mt-5 grid grid-cols-1 gap-4">{children}</div>
    </div>
  );
}

export function MobileCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-app-border bg-app-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      {children}
    </section>
  );
}
