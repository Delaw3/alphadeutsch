"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { formatNaira, type MobileCourseRow } from "@/lib/mobile-api";

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
  { label: "Profile & Support", route: "/profile", keywords: "profile account settings support contact phone email address" },
];

const ANNOUNCEMENTS: { label: string; body: string; route: string; keywords: string }[] = [
  { label: "Registration open", body: "New A1 class starts soon — secure your place.", route: "/register", keywords: "registration open new class a1 enrol" },
  { label: "Results update", body: "Check your latest sitting results now.", route: "/result", keywords: "results update latest sitting exam" },
];

type Reg = {
  id: number;
  course_id: number;
  course_title: string;
  course_display: string;
  level: string | null;
  payment_status: string;
  date_registered: string | null;
};

function levelOf(title: string): Level {
  if (title.startsWith("Family")) return "Family Reunion";
  const head = title.split(" ")[0];
  return (LEVELS.includes(head as Level) ? head : "All") as Level;
}

function match(hay: string, q: string): boolean {
  return hay.toLowerCase().includes(q);
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level>("All");
  const [courses, setCourses] = useState<MobileCourseRow[]>([]);
  const [courseStatus, setCourseStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [regs, setRegs] = useState<Reg[]>([]);
  const [regsLoaded, setRegsLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLevel("All");
  }, [open]);

  // Load everything searchable the first time the overlay opens.
  useEffect(() => {
    if (!open) return;
    if (courseStatus === "idle") {
      setCourseStatus("loading");
      apiFetch<{ data: MobileCourseRow[] }>("/api/courses", { query: { open: "all" } })
        .then((d) => {
          setCourses(d.data ?? []);
          setCourseStatus("ready");
        })
        .catch(() => setCourseStatus("error"));
    }
    if (!regsLoaded && hasSessionToken()) {
      setRegsLoaded(true);
      apiFetch<{ data: Reg[] }>("/api/me/registrations")
        .then((d) => setRegs(d.data ?? []))
        .catch(() => {
          /* ignore */
        });
    }
  }, [open, courseStatus, regsLoaded]);

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
  const levelOnly = level !== "All";

  const courseResults = useMemo(
    () =>
      courses.filter((c) => {
        if (levelOnly && levelOf(c.title) !== level) return false;
        if (!q) return levelOnly;
        return match(`${c.title} ${c.display} ${c.description}`, q);
      }),
    [courses, level, levelOnly, q],
  );

  const screenResults = useMemo(
    () => SCREENS.filter((s) => !q || match(`${s.label} ${s.keywords}`, q)),
    [q],
  );

  const myCourseResults = useMemo(
    () =>
      regs.filter(
        (r) => !q || match(`${r.course_title ?? ""} ${r.course_display ?? ""} ${r.level ?? ""}`, q),
      ),
    [regs, q],
  );

  const resultLinks = useMemo(
    () =>
      regs
        .filter((r) => r.payment_status === "Yes")
        .filter((r) => !q || match(`${r.course_title ?? ""}`, q)),
    [regs, q],
  );

  const announcementResults = useMemo(
    () => ANNOUNCEMENTS.filter((a) => !q || match(`${a.label} ${a.body} ${a.keywords}`, q)),
    [q],
  );

  if (!open || !mounted) return null;

  const showPages = !levelOnly && screenResults.length > 0;
  const showMyCourses = !levelOnly && myCourseResults.length > 0;
  const showResults = !levelOnly && resultLinks.length > 0;
  const showAnnouncements = !levelOnly && announcementResults.length > 0;
  const showCourses = courseResults.length > 0;
  const nothing =
    !showPages && !showMyCourses && !showResults && !showAnnouncements && !showCourses && courseStatus === "ready";

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
                placeholder="Search the app — courses, results, pages…"
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
              aria-label="Close search"
              onClick={onClose}
              className="focus-ring grid size-10 shrink-0 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

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
          {courseStatus === "loading" ? (
            <p className="py-6 text-center text-sm text-app-muted">Loading…</p>
          ) : null}
          {courseStatus === "error" ? (
            <p className="py-6 text-center text-sm text-app-muted">Could not load data. Please try again.</p>
          ) : null}

          {showPages ? (
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Pages & actions</h2>
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

          {showMyCourses ? (
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">My courses</h2>
              <ul className="grid gap-2">
                {myCourseResults.map((r) => (
                  <li key={r.id}>
                    <Link
                      href="/my-courses"
                      onClick={onClose}
                      className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 hover:bg-app-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-app-text">
                          {r.course_title || `Course #${r.course_id}`}
                        </span>
                        <span className="block text-[12px] text-app-muted">{r.course_display}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                          r.payment_status === "Yes"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {r.payment_status === "Yes" ? "Paid" : "Unpaid"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showResults ? (
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Results</h2>
              <ul className="grid gap-1">
                {resultLinks.map((r) => (
                  <li key={`res-${r.id}`}>
                    <Link
                      href="/result"
                      onClick={onClose}
                      className="focus-ring flex min-h-[44px] items-center justify-between rounded-xl px-3 text-sm font-bold text-app-text hover:bg-app-surface-2"
                    >
                      <span className="truncate">Check result — {r.course_title || `Course #${r.course_id}`}</span>
                      <span aria-hidden="true" className="text-app-muted">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showCourses ? (
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">
                Courses{courseResults.length ? ` (${courseResults.length})` : ""}
              </h2>
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
                          {c.is_open !== 1 ? " · Closed" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-black tabular-nums text-app-text">{formatNaira(c.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showAnnouncements ? (
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Announcements</h2>
              <ul className="grid gap-2">
                {announcementResults.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.route}
                      onClick={onClose}
                      className="focus-ring block rounded-2xl border border-app-border bg-app-surface px-4 py-3 hover:bg-app-surface-2"
                    >
                      <span className="block text-sm font-black text-app-text">{a.label}</span>
                      <span className="mt-0.5 block text-[12px] text-app-muted">{a.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {nothing ? (
            <p className="py-8 text-center text-sm text-app-muted">No matches found for “{query.trim()}”.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
