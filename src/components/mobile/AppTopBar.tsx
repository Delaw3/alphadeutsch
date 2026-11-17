"use client";

import { useEffect, useState } from "react";
import { Search, X, Sun, Moon, Bell } from "lucide-react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { AppMenu } from "./AppMenu";

type Me = { name: string | null };

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Reusable sticky top bar (menu + greeting/name + actions) used on
 * course and learning screens. Self-contained: fetches the signed-in
 * user's name and manages the theme + search toggle.
 */
export function AppTopBar() {
  const [me, setMe] = useState<Me | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dark, setDark] = useState(false);
  const notifCount = 0;

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
    if (!hasSessionToken()) return;
    let cancelled = false;
    apiFetch<Me>("/api/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = me?.name?.split(" ")[0] ?? "";
  const greeting = greetingForHour(new Date().getHours());

  return (
    <header className="sticky top-0 z-40 border-b border-app-border/60 bg-app-bg/95 backdrop-blur-xl pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4">
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses, results…"
              className="focus-ring min-h-[40px] flex-1 rounded-full border border-app-border bg-app-surface px-4 text-sm text-app-text placeholder:text-app-muted"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="focus-ring grid size-10 shrink-0 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <AppMenu />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-app-muted">{greeting}</p>
                <h1 className="truncate text-lg font-black leading-tight text-app-text">
                  {firstName || "Welcome"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
                className="focus-ring grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
              >
                <Search size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                className="focus-ring grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
              >
                {dark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
              </button>
              <button
                type="button"
                aria-label="Notifications"
                className="focus-ring relative grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
              >
                <Bell size={18} strokeWidth={2} />
                {notifCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-black text-white">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                ) : null}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
