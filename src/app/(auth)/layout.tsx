import type { ReactNode } from "react";

import { siteConfig } from "@/lib/constants";

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="mobile-app-shell min-h-dvh bg-app-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <img
            src="/icon.svg"
            alt="Alpha Deutsch"
            className="h-10 w-auto mb-1"
          />
          <h2 className="text-2xl font-black text-app-text tracking-tight">
            {siteConfig.name}
          </h2>
          <p className="text-sm text-app-muted">
            German courses · A1–C1 · Awka
          </p>
        </div>
        <div className="rounded-3xl border border-app-border bg-app-surface p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          {children}
        </div>
      </div>
    </div>
  );
}
