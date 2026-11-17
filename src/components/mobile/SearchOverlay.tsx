"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { fetchOpenCourses, formatNaira, type MobileCourseRow } from "@/lib/mobile-api";

const LEVELS = ["All", "A1", "A2", "B1", "B2", "C1", "Family Reunion"] as const;
type Level = (typeof LEVELS)[number];

const SCREENS: { label: string; route: string; keywords: string }[] = [
  { label: "Home", route: "/home", keywords: "home dashboard start" },
  { label: "Courses", route: "/courses", keywords: "courses catalogue levels prices german" },
  { label: "My Learning", route: "/learning", keywords: "learning progress my learning" },
  { label: "Check Result", route: "/result", keywords: "result exam score grades sitting" },
  { label: "My Courses", route: "/my-courses", keywords: "registrations enrolled my courses" },
  { label: "Register", route: "/register", keywords: "register enrol enrolment signup course" },
  { label: "Pay", route: "/pay", keywords: "pay payment fees portal" },
  { label: "Profile", route: "/profile", keywords: "profile account settings support contact" },
];

function levelOf(title: string): Level {
  if (title.startsWith("Family")) return "Family Reunion";
  const head = title.split(" ")[0];
  return (LEVELS.includes(head as Level) ? head : "All") as Level;
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level>("All");
  const [courses, setCourses] = useState<MobileCourseRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset query/filter each time the search opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLevel("All");
  }, [open]);

  // Load the course catalogue once, the first time the overlay opens.
  useEffect(() => {
    if (!open || status !== "idle") return;
    setStatus("loading");
    fetchOpenCourses()
      .then((rows) => {
        setCourses(rows);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [open, status]);

  // Lock body scroll + Escape to close while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  const courseResults = useMemo(() => {
    return courses.filter((c) => {
      if (level !== "All" && levelOf(c.title) !== level) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.display} ${c.description}`.toLowerCase();
      return hay.includes(q);
    });
  }, [courses, level, q]);

  const screenResults = useMemo(() => {
    if (!q) return [];
    return SCREENS.filter((s) => `${s.label} ${s.keywords}`.toLowerCase().includes(q)).slice(0, 4);
  }, [q]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex flex-col bg-app-bg">
      <div className="border-b border-app-border bg-app-surface pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="mx-auto w-full max-w-lg px-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-app-border bg-app-surface-2 px-4">
              <Search size={18} strokeWidth={2} className="text-app-muted" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses, results, pages…"
                className="min-h-[44px] flex-1 bg-transparent text-sm text-app-text placeholder:text-app-muted focus:outline-none"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-app-muted">
                  <X size={16} strokeWidth={2} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-black text-app-text"
            >
              Cancel
            </button>
          </div>

          {/* Filters shown below the search bar (default: All) */}
          <div
            role="tablist"
            aria-label="Filter by course level"
            className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {LEVELS.map((lvl) => {
              const active = lvl === level;
              return (
                <button
                  key={lvl}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLevel(lvl)}
                  className={`focus-ring inline-flex min-h-[36px] shrink-0 items-center rounded-full px-4 text-[13px] font-black transition ${
                    active
                      ? "bg-app-accent text-app-on-accent"
                      : "bg-app-surface-2 text-app-muted ring-1 ring-app-border"
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-4">
          {status === "loading" ? <p className="py-8 text-center text-sm text-app-muted">Loading…</p> : null}
          {status === "error" ? (
            <p className="py-8 text-center text-sm text-app-muted">Could not load courses. Please try again.</p>
          ) : null}

          {screenResults.length > 0 ? (
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Pages</h2>
              <ul className="grid gap-1">
                {screenResults.map((s) => (
                  <li key={s.route}>
                    <Link
                      href={s.route}
                      onClick={onClose}
                      className="focus-ring flex min-h-[44px] items-center rounded-xl px-3 text-sm font-bold text-app-text hover:bg-app-surface-2"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {status === "ready" ? (
            <section>
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">
                Courses{courseResults.length ? ` (${courseResults.length})` : ""}
              </h2>
              {courseResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-app-muted">No matches found.</p>
              ) : (
                <ul className="grid gap-2">
                  {courseResults.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/courses/${c.id}`}
                        onClick={onClose}
                        className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 hover:bg-app-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-app-text">{c.title}</span>
                          <span className="block text-[12px] text-app-muted">
                            {c.display} · {levelOf(c.title)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-black tabular-nums text-app-text">
                          {formatNaira(c.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
