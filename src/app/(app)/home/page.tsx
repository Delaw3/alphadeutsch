"use client";

import Link from "next/link";
import { useState } from "react";
import { X, GraduationCap, FileText, BookOpen, CreditCard } from "lucide-react";

type Announcement = { id: string; title: string; body: string; icon: React.ReactNode; gradient: string };

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
  const visibleAnnouncements = ANNOUNCEMENTS.filter((a) => !dismissed.includes(a.id));

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

      <div className="relative mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { icon: (<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16v12H4z" /><path d="M8 10h8M8 14h5" /></svg>), label: "0 courses" },
            { icon: (<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5" /></svg>), label: "0 results" },
            { icon: (<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>), label: "Unpaid 0" },
          ].map((chip) => (
            <span key={chip.label} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-app-surface-2 px-4 py-2 text-[12px] font-bold text-app-text">
              <span aria-hidden="true" className="text-app-muted">{chip.icon}</span>
              {chip.label}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-app-bg to-transparent" />
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
