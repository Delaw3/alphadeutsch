"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "alphadeutsch-theme";

const menuLinks = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/learning", label: "My Learning" },
  { href: "/result", label: "Check Result" },
  { href: "/my-courses", label: "My Courses" },
  { href: "/register", label: "Register" },
  { href: "/pay", label: "Pay" },
  { href: "/profile", label: "Profile" },
] as const;

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 fill-none stroke-current stroke-[1.8]"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 fill-none stroke-current stroke-[1.8]"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8.2 8.2 0 1 0 20 14.5Z" />
    </svg>
  );
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private browsing, disabled cookies).
  }
  return null;
}

function ThemeSetting() {
  // The panel only renders after a user interaction (menu is closed during
  // SSR), so reading the DOM here cannot cause a hydration mismatch.
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    return "light";
  });

  function applyTheme(next: Theme) {
    if (next === theme) return; // idempotent: no duplicate work for the same value
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the in-memory class toggle still applies.
    }
    setTheme(next);
  }

  const options = [
    { value: "light" as const, label: "Light", icon: <SunIcon /> },
    { value: "dark" as const, label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <div className="border-t border-app-border p-3">
      <p
        id="app-menu-theme-label"
        className="px-1 text-[11px] font-black uppercase tracking-[0.16em] text-app-muted"
      >
        Theme
      </p>
      <div
        role="group"
        aria-labelledby="app-menu-theme-label"
        className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-app-border bg-app-surface-2 p-1"
      >
        {options.map((option) => {
          const active = option.value === theme;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => applyTheme(option.value)}
              className={`focus-ring inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-black transition ${
                active
                  ? "bg-app-accent text-app-on-accent"
                  : "text-app-muted hover:text-app-text"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


export function AppMenu() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Never leave a stale menu open across navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent | MouseEvent) {
      const target = event.target;
      if (target instanceof Node && containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="app-menu-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        title={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className={`focus-ring inline-flex size-11 items-center justify-center rounded-full border transition active:scale-[0.98] ${
          open
            ? "border-transparent bg-app-accent text-[#0a1224]"
            : "border-app-border bg-app-surface text-app-text hover:bg-app-surface-2"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5 fill-none stroke-current stroke-2"
        >
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open ? (
        <div
          id="app-menu-panel"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-app-border bg-app-surface p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
        >
          <nav aria-label="Main menu">
            <ul className="grid gap-1">
              {menuLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`focus-ring flex min-h-[44px] items-center justify-between rounded-2xl px-3 text-sm font-bold transition ${
                        active
                          ? "bg-app-surface-2 text-app-text"
                          : "text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                      }`}
                    >
                      <span>{link.label}</span>
                      {active ? (
                        <span aria-hidden="true" className="size-2 rounded-full bg-app-accent" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeSetting />
        </div>
      ) : null}
    </div>
  );
}
