"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, GraduationCap, FileText, BookOpen, CreditCard } from "lucide-react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";

type Announcement = { id: string; title: string; body: string; icon: React.ReactNode; gradient: string };
type Overview = { courses: number; results: number; unpaid: number };

const ANNOUNCEMENTS: Announcement[] = [
  { id: "reg-open", title: "Registration open", body: "New A1 class starts soon — secure your place.", icon: <FileText size={24} strokeWidth={2} />, gradient: "from-app-accent/30 to-app-accent/10" },
  { id: "results-update", title: "Results update", body: "Check your latest sitting results now.", icon: <GraduationCap size={24} strokeWidth={2} />, gradient: "from-blue-500/20 to-blue-500/5" },
];

const QUICK_ACTIONS = [
  { id: "check-result", label: "Check result", icon: <GraduationCap size={20} strokeWidth={2} />, route: "/result" },
  { id: "register-course", label: "Register", icon: <FileText size={20} strokeWidth={2} />, route: "/register" },
  { id: "my-courses", label: "My courses", icon: <BookOpen size={20} strokeWidth={2} />, route: "/my-courses" },
  { id: "pay", label: "Pay", icon: <CreditCard size={20} strokeWidth={2} />, route: "/pay" },
];

export default function HomePage() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [stats, setStats] = useState<Overview | null>(null);
  const visibleAnnouncements = ANNOUNCEMENTS.filter((a) => !dismissed.includes(a.id));

  useEffect(() => {
    if (!hasSessionToken()) return;
    let cancelled = false;
    apiFetch<Overview>("/api/me/overview")
      .then((d) => {
        if (!cancelled) setStats({ courses: d.courses ?? 0, results: d.results ?? 0, unpaid: d.unpaid ?? 0 });
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const STATS = [
    { id: "courses", label: "My courses", value: stats?.courses, route: "/my-courses", icon: <BookOpen size={18} strokeWidth={2} /> },
    { id: "results", label: "Results", value: stats?.results, route: "/result", icon: <GraduationCap size={18} strokeWidth={2} /> },
    { id: "unpaid", label: "Unpaid", value: stats?.unpaid, route: "/pay", icon: <CreditCard size={18} strokeWidth={2} /> },
  ];

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-3">
      <section className="relative mt-1 overflow-hidden rounded-3xl bg-gradient-to-br from-app-accent via-[#ffd86b] to-[#ffb800] p-6 shadow-[0_20px_50px_rgba(255,200,60,0.25)] motion-reduce:transition-none">
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-6 text-[120px] font-black leading-none text-app-on-accent/15">A</span>
        <div className="relative">
          <h2 className="text-2xl font-black text-app-on-accent">Alpha Deutsch</h2>
          <p className="mt-1 text-sm font-bold text-app-on-accent/80">German courses · A1–C1 · Awka</p>
        </div>
      </section>

      {visibleAnnouncements.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {visibleAnnouncements.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 rounded-2xl bg-gradient-to-r ${a.gradient} border border-app-border p-4 shadow-sm transition motion-reduce:transition-none`}>
              <span aria-hidden="true" className="text-2xl">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-app-text">{a.title}</p>
                <p className="mt-0.5 text-[12px] text-app-muted">{a.body}</p>
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => setDismissed((prev) => [...prev, a.id])} className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-app-muted transition hover:bg-app-surface-2 active:scale-90"><X size={16} strokeWidth={2} /></button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {STATS.map((s) => {
          const isDanger = s.id === "unpaid" && (s.value ?? 0) > 0;
          return (
            <Link
              key={s.id}
              href={s.route}
              className="focus-ring flex flex-col items-center rounded-2xl border border-app-border bg-app-surface p-3 text-center transition hover:bg-app-surface-2 active:scale-[0.98]"
            >
              <span className="grid size-9 place-items-center rounded-full bg-app-accent/20 text-app-on-accent dark:text-white">
                {s.icon}
              </span>
              <span className={`mt-2 text-lg font-black tabular-nums ${isDanger ? "text-red-600 dark:text-red-400" : "text-app-text"}`}>
                {s.value === undefined ? "–" : s.value}
              </span>
              <span className="text-[11px] font-bold text-app-muted">{s.label}</span>
            </Link>
          );
        })}
      </div>

      <section className="mt-6">
        <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-app-muted">Quick actions</h2>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.id} href={action.route} className="focus-ring flex flex-col items-center gap-2 transition active:scale-95">
              <span className="grid size-14 place-items-center rounded-full bg-app-accent/20 text-2xl text-app-on-accent transition dark:text-white">{action.icon}</span>
              <span className="text-[11px] font-bold text-app-text">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
