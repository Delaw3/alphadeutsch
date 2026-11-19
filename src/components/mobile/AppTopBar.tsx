"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Sun, Moon, Bell } from "lucide-react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { greetingForNow } from "@/lib/greetings";
import { givenName } from "@/lib/names";
import { formatNaira, type MobileCourseRow } from "@/lib/mobile-api";
import { AppMenu } from "./AppMenu";

type Me = { name: string | null };
type Reg = {
  id: number;
  course_id: number;
  course_title: string;
  course_display: string;
  level: string | null;
  payment_status: string;
  date_registered: string | null;
};

const FILTERS = ["All", "Courses", "My Courses", "Results", "Pages", "Announcements"] as const;
type Filter = (typeof FILTERS)[number];

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

function levelOf(title: string): string {
  if (title.startsWith("Family")) return "Family Reunion";
  return title.split(" ")[0] ?? "";
}
function match(hay: string, q: string) {
  return hay.toLowerCase().includes(q);
}

export function AppTopBar() {
  const [me, setMe] = useState<Me | null>(null);
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [courses, setCourses] = useState<MobileCourseRow[]>([]);
  const [courseStatus, setCourseStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [regs, setRegs] = useState<Reg[]>([]);
  const [regsLoaded, setRegsLoaded] = useState(false);
  const notifCount = 0;

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("alphadeutsch-theme") : null;
    const isDark = stored === "dark" || (stored !== "light" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem("alphadeutsch-theme", next ? "dark" : "light"); } catch { /* ignore */ }
    document.documentElement.classList.toggle("dark", next);
  }

  useEffect(() => {
    if (!hasSessionToken()) return;
    let cancelled = false;
    apiFetch<Me>("/api/me").then((d) => { if (!cancelled) setMe(d); }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (!searchOpen) return; setQuery(""); setFilter("All"); }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    if (courseStatus === "idle") {
      setCourseStatus("loading");
      apiFetch<{ data: MobileCourseRow[] }>("/api/courses", { query: { open: "all" } })
        .then((d) => { setCourses(d.data ?? []); setCourseStatus("ready"); })
        .catch(() => setCourseStatus("error"));
    }
    if (!regsLoaded && hasSessionToken()) {
      setRegsLoaded(true);
      apiFetch<{ data: Reg[] }>("/api/me/registrations").then((d) => setRegs(d.data ?? [])).catch(() => { /* ignore */ });
    }
  }, [searchOpen, courseStatus, regsLoaded]);

  useEffect(() => {
    if (!searchOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSearchOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const q = query.trim().toLowerCase();
  const courseResults = useMemo(() => { if (filter !== "Courses" && q === "") return []; return courses.filter((c) => !q || match(`${c.title} ${c.display} ${c.description}`, q)); }, [courses, filter, q]);
  const screenResults = useMemo(() => SCREENS.filter((s) => !q || match(`${s.label} ${s.keywords}`, q)), [q]);
  const myCourseResults = useMemo(() => regs.filter((r) => !q || match(`${r.course_title ?? ""} ${r.course_display ?? ""} ${r.level ?? ""}`, q)), [regs, q]);
  const resultLinks = useMemo(() => regs.filter((r) => r.payment_status === "Yes").filter((r) => !q || match(`${r.course_title ?? ""}`, q)), [regs, q]);
  const announcementResults = useMemo(() => ANNOUNCEMENTS.filter((a) => !q || match(`${a.label} ${a.body} ${a.keywords}`, q)), [q]);

  const showPages = (filter === "All" || filter === "Pages") && screenResults.length > 0;
  const showMyCourses = (filter === "All" || filter === "My Courses") && myCourseResults.length > 0;
  const showResults = (filter === "All" || filter === "Results") && resultLinks.length > 0;
  const showAnnouncements = (filter === "All" || filter === "Announcements") && announcementResults.length > 0;
  const showCourses = (filter === "All" || filter === "Courses") && courseResults.length > 0;
  const nothing = !showPages && !showMyCourses && !showResults && !showAnnouncements && !showCourses && courseStatus === "ready";

  const firstName = givenName(me?.name);
  const greeting = greetingForNow();

  return (
    <header className="sticky top-0 z-40 bg-app-bg pt-[max(env(safe-area-inset-top),2rem)] pb-3">
      <div className="mx-auto w-full max-w-lg px-4">
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-app-border bg-app-surface-2 px-4">
              <Search size={18} strokeWidth={2} className="text-app-muted" />
              <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the app — courses, results, pages…" className="min-h-[40px] flex-1 bg-transparent text-sm text-app-text placeholder:text-app-muted focus:outline-none" />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-app-muted"><X size={16} strokeWidth={2} /></button>
              ) : null}
            </div>
            <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="focus-ring grid size-10 shrink-0 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"><X size={18} strokeWidth={2} /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AppMenu />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-app-muted">{greeting}</p>
                <h1 className="truncate text-lg font-black leading-tight text-app-text">{firstName || "Willkommen"}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="focus-ring grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95"><Search size={18} strokeWidth={2} /></button>
              <button type="button" onClick={toggleTheme} aria-label="Toggle dark mode" className="focus-ring grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95">{dark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}</button>
              <button type="button" aria-label="Notifications" className="focus-ring relative grid size-10 place-items-center rounded-full border border-app-border bg-app-surface text-app-text transition active:scale-95">
                <Bell size={18} strokeWidth={2} />
                {notifCount > 0 ? (<span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-black text-white">{notifCount > 9 ? "9+" : notifCount}</span>) : null}
              </button>
            </div>
          </div>
        )}

        {searchOpen ? (
          <div className="mt-3">
            <div role="tablist" aria-label="Filter by app section" className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((item) => {
                const active = item === filter;
                return (
                  <button key={item} type="button" role="tab" aria-selected={active} onClick={() => setFilter(item)} className={`focus-ring inline-flex min-h-[36px] shrink-0 items-center rounded-full px-4 text-[13px] font-black transition ${active ? "bg-app-accent text-app-on-accent" : "bg-app-surface-2 text-app-muted ring-1 ring-app-border"}`}>{item}</button>
                );
              })}
            </div>

            <div className="mt-3 max-h-[58vh] overflow-y-auto">
              {courseStatus === "loading" ? (<p className="py-6 text-center text-sm text-app-muted">Loading…</p>) : null}
              {courseStatus === "error" ? (<p className="py-6 text-center text-sm text-app-muted">Could not load data. Please try again.</p>) : null}

              {showPages ? (
                <section className="mb-4">
                  <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Pages & actions</h2>
                  <ul className="grid gap-1">
                    {screenResults.map((s) => (
                      <li key={s.route}>
                        <Link href={s.route} onClick={() => setSearchOpen(false)} className="focus-ring flex min-h-[44px] items-center rounded-xl px-3 text-sm font-bold text-app-text hover:bg-app-surface-2">{s.label}</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {showMyCourses ? (
                <section className="mb-4">
                  <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">My courses</h2>
                  <ul className="grid gap-2">
                    {myCourseResults.map((r) => (
                      <li key={r.id}>
                        <Link href="/my-courses" onClick={() => setSearchOpen(false)} className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 hover:bg-app-surface-2">
                          <span className="min-w-0"><span className="block truncate text-sm font-black text-app-text">{r.course_title || `Course #${r.course_id}`}</span><span className="block text-[12px] text-app-muted">{r.course_display}</span></span>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${r.payment_status === "Yes" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>{r.payment_status === "Yes" ? "Paid" : "Unpaid"}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {showResults ? (
                <section className="mb-4">
                  <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Results</h2>
                  <ul className="grid gap-1">
                    {resultLinks.map((r) => (
                      <li key={`res-${r.id}`}>
                        <Link href="/result" onClick={() => setSearchOpen(false)} className="focus-ring flex min-h-[44px] items-center justify-between rounded-xl px-3 text-sm font-bold text-app-text hover:bg-app-surface-2"><span className="truncate">Check result — {r.course_title || `Course #${r.course_id}`}</span><span aria-hidden="true" className="text-app-muted">›</span></Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {showCourses ? (
                <section className="mb-4">
                  <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Courses{courseResults.length ? ` (${courseResults.length})` : ""}</h2>
                  <ul className="grid gap-2">
                    {courseResults.map((c) => (
                      <li key={c.id}>
                        <Link href={`/courses/${c.id}`} onClick={() => setSearchOpen(false)} className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 hover:bg-app-surface-2">
                          <span className="min-w-0"><span className="block truncate text-sm font-black text-app-text">{c.title}</span><span className="block text-[12px] text-app-muted">{c.display} · {levelOf(c.title)}{c.is_open !== 1 ? " · Closed" : ""}</span></span>
                          <span className="shrink-0 text-sm font-black tabular-nums text-app-text">{formatNaira(c.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {showAnnouncements ? (
                <section className="mb-4">
                  <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">Announcements</h2>
                  <ul className="grid gap-2">
                    {announcementResults.map((a) => (
                      <li key={a.label}>
                        <Link href={a.route} onClick={() => setSearchOpen(false)} className="focus-ring block rounded-2xl border border-app-border bg-app-surface px-4 py-3 hover:bg-app-surface-2"><span className="block text-sm font-black text-app-text">{a.label}</span><span className="mt-0.5 block text-[12px] text-app-muted">{a.body}</span></Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {nothing ? (<p className="py-8 text-center text-sm text-app-muted">No matches found</p>) : null}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
