"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Home,
  BookOpen,
  GraduationCap,
  Award,
  Library,
  FileText,
  CreditCard,
  User,
  X,
  Sun,
  Moon,
} from "lucide-react";

type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "alphadeutsch-theme";

const menuLinks = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/learning", label: "My Learning", icon: GraduationCap },
  { href: "/result", label: "Check Result", icon: Award },
  { href: "/my-courses", label: "My Courses", icon: Library },
  { href: "/register", label: "Register", icon: FileText },
  { href: "/pay", label: "Pay", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
] as const;

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
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    return "light";
  });

  function applyTheme(next: Theme) {
    if (next === theme) return;
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
    setTheme(next);
  }

  const options = [
    { value: "light" as const, label: "Light", Icon: Sun },
    { value: "dark" as const, label: "Dark", Icon: Moon },
  ];

  return (
    <div>
      <p className="px-1 text-[11px] font-black uppercase tracking-[0.16em] text-app-muted">Appearance</p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-app-surface-2 p-1 ring-1 ring-app-border">
        {options.map((option) => {
          const active = option.value === theme;
          const Icon = option.Icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => applyTheme(option.value)}
              className={`focus-ring inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-black transition-colors ${
                active ? "bg-app-accent text-app-on-accent shadow-sm" : "text-app-muted hover:text-app-text"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              <span>{option.label}</span>
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
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const overlay =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[999]">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              tabIndex={-1}
            />
            <div
              id="app-menu-panel"
              className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-app-border bg-app-surface shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
            >
              {/* Brand header */}
              <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-2xl bg-app-accent text-sm font-black text-app-on-accent">A</span>
                  <div className="leading-tight">
                    <p className="text-sm font-black text-app-text">Alpha Deutsch</p>
                    <p className="text-[11px] text-app-muted">Learning app</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="focus-ring grid size-9 place-items-center rounded-full text-app-muted transition hover:bg-app-surface-2 hover:text-app-text"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              {/* Nav */}
              <nav aria-label="Main menu" className="flex-1 overflow-y-auto px-3 pb-3">
                <ul className="grid gap-1">
                  {menuLinks.map((link) => {
                    const active =
                      pathname === link.href ||
                      (link.href !== "/home" && pathname.startsWith(`${link.href}/`));
                    const Icon = link.icon;
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-bold transition ${
                            active
                              ? "bg-app-accent/15 text-app-text"
                              : "text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                          }`}
                        >
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-xl transition ${
                              active
                                ? "bg-app-accent text-app-on-accent"
                                : "bg-app-surface-2 text-app-muted group-hover:text-app-text"
                            }`}
                          >
                            <Icon size={18} strokeWidth={2} />
                          </span>
                          <span className="flex-1">{link.label}</span>
                          {active ? <span aria-hidden="true" className="size-2 rounded-full bg-app-accent" /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="border-t border-app-border p-3">
                <ThemeSetting />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        title={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className={`focus-ring inline-flex size-11 items-center justify-center rounded-full border transition active:scale-[0.98] ${
          open
            ? "border-transparent bg-app-accent text-[#0a1224]"
            : "border-app-border bg-app-surface text-app-text hover:bg-app-surface-2"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-2">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" />
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>
      {overlay}
    </div>
  );
}
