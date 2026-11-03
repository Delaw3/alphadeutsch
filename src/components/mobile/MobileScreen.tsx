"use client";

import type { ReactNode } from "react";

export function MobileScreen({
  title,
  eyebrow,
  description,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-[16rem] pt-5">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-app-muted">{eyebrow}</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-black leading-tight text-app-text">{title}</h1>
        {action}
      </div>
      {description ? <p className="mt-2 text-sm leading-6 text-app-muted">{description}</p> : null}
      <div className="mt-5 grid gap-4">{children}</div>
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
