"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function TabIcon({ kind, active }: { kind: "home" | "courses" | "learning" | "profile"; active: boolean }) {
  const cls = `size-6 fill-none stroke-current stroke-[1.8] ${active ? "" : "opacity-80"}`;
  if (kind === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cls}>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V19h11v-8.5" />
        <path d="M10 19v-5h4v5" />
      </svg>
    );
  }
  if (kind === "courses") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cls}>
        <path d="M5 5h14v15H5z" />
        <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
      </svg>
    );
  }
  if (kind === "learning") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cls}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cls}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M7.5 16.2c.9-2 2.5-3 4.5-3s3.6 1 4.5 3" />
    </svg>
  );
}

const tabs = [
  { href: "/home", label: "Home", kind: "home" as const, exact: true },
  { href: "/courses", label: "Courses", kind: "courses" as const, exact: false },
  { href: "/learning", label: "My Learning", kind: "learning" as const, exact: false },
  { href: "/profile", label: "Profile", kind: "profile" as const, exact: false },
];

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Alpha Deutsch app sections"
      className="mobile-bottom-nav fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-40 rounded-3xl border border-app-border bg-app-surface/95 px-2 py-2 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-bold transition ${
                active
                  ? "bg-app-accent text-app-on-accent"
                  : "text-app-muted hover:bg-app-surface-2 hover:text-app-text"
              }`}
            >
              <TabIcon kind={tab.kind} active={active} />
              <span className="leading-none">{tab.label}</span>
              <span
                aria-hidden="true"
                className={`h-1 w-8 rounded-full ${active ? "bg-app-on-accent" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileSafeArea({ children }: { children: ReactNode }) {
  return <div className="mobile-safe-area">{children}</div>;
}
