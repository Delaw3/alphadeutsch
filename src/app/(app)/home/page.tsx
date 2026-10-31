"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { features } from "@/lib/features";
import { MobileCard } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";

type Me = { name: string | null; reg_no?: string | null };

type Announcement = { id: string; title: string; body: string; emoji: string; gradient: string };

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "reg-open",
    title: "Registration open",
    body: "New A1 class starts soon — secure your place.",
    emoji: "📝",
    gradient: "from-app-accent/30 to-app-accent/10",
  },
  {
    id: "results-update",
    title: "Results update",
    body: "Check your latest sitting results now.",
    emoji: "🎓",
    gradient: "from-blue-500/20 to-blue-500/5",
  },
];

const QUICK_ACTIONS = [
  { id: "check-result", label: "Check result", icon: "🎓", route: "/result" },
  { id: "register-course", label: "Register", icon: "📝", route: "/register" },
  { id: "my-courses", label: "My courses", icon: "📘", route: "/my-courses" },
  { id: "pay", label: "Pay", icon: "💳", route: "/pay" },
];

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "AD";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const notifCount = 0;
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("alphadeutsch-theme") : null;
    const isDark =
      stored === "dark" ||
      (stored !== "light" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("alphadeutsch-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("dark", next);
  }

  useEffect(() => {
    if (!hasSessionToken()) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    apiFetch<Me>("/api/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = me?.name?.split(" ")[0] ?? "";
  const greeting = greetingForHour(new Date().getHours());

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 animate-pulse rounded-full bg-app-surface-2" />
            <div className="grid gap-2">
              <div className="h-3 w-24 animate-pulse rounded bg-app-surface-2" />
              <div className="h-4 w-32 animate-pulse rounded bg-app-surface-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="size-10 animate-pulse rounded-full bg-app-surface-2" />
            <div className="size-10 animate-pulse rounded-full bg-app-surface-2" />
          </div>
        </div>
        <div className="mt-5 h-40 animate-pulse rounded-3xl bg-app-surface-2" />
        <div className="mt-5 grid gap-3">
          <div className="h-20 animate-pulse rounded-2xl bg-app-surface-2" />
          <div className="h-20 animate-pulse rounded-2xl bg-app-surface-2" />
        </div>
      </div>
    );
  }

  const visibleAnnouncements = ANNOUNCEMENTS.filter((a) => !dismissed.includes(a.id));

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-5">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-app-accent text-sm font-black text-app-on-accent">
            {initialsOf(me?.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-app-muted">{greeting}</p>
            <h1 className="truncate text-lg font-black leading-tight text-app-text">
              {firstName ? firstName : "Welcome"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="focus-ring grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="focus-ring relative grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
          >
            🔔
            {notifCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-black text-white">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      {/* Hero banner */}
      <section className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-app-accent via-[#ffd86b] to-[#ffb800] p-6 shadow-[0_20px_50px_rgba(255,200,60,0.25)] motion-reduce:transition-none">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -bottom-6 text-[120px] font-black leading-none text-app-on-accent/15"
        >
          A
        </span>
        <div className="relative">
          <h2 className="text-2xl font-black text-app-on-accent">Alpha Deutsch</h2>
          <p className="mt-1 text-sm font-bold text-app-on-accent/80">
            German courses · A1–C1 · Awka
          </p>
        </div>
      </section>

      {/* Announcements */}
      {visibleAnnouncements.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {visibleAnnouncements.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-2xl bg-gradient-to-r ${a.gradient} border border-app-border p-4 shadow-sm transition motion-reduce:transition-none`}
            >
              <span aria-hidden="true" className="text-2xl">
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-app-text">{a.title}</p>
                <p className="mt-0.5 text-[12px] text-app-muted">{a.body}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissed((prev) => [...prev, a.id])}
                className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-app-muted transition hover:bg-app-surface-2 active:scale-90"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Stat chips */}
      <div className="relative mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            {
              icon: (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16v12H4z" />
                  <path d="M8 10h8M8 14h5" />
                </svg>
              ),
              label: "0 courses",
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l9 5-9 5-9-5 9-5z" />
                  <path d="M3 12l9 5 9-5" />
                </svg>
              ),
              label: "0 results",
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M3 10h18" />
                </svg>
              ),
              label: "Unpaid 0",
            },
          ].map((chip) => (
            <span
              key={chip.label}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-app-surface-2 px-4 py-2 text-[12px] font-bold text-app-text"
            >
              <span aria-hidden="true" className="text-app-muted">
                {chip.icon}
              </span>
              {chip.label}
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-app-bg to-transparent"
        />
      </div>

      {/* Quick actions */}
      <section className="mt-6">
        <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-app-muted">
          Quick actions
        </h2>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.id}
              href={action.route}
              className="focus-ring flex flex-col items-center gap-2 transition active:scale-95"
            >
              <span className="grid size-14 place-items-center rounded-full bg-app-accent/20 text-2xl text-app-on-accent transition">
                {action.icon}
              </span>
              <span className="text-[11px] font-bold text-app-text">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
