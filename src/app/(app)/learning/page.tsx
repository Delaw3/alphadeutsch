"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, AlertTriangle, Play } from "lucide-react";
import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { MobileStateCard } from "@/components/mobile/MobileStates";

type Me = {
  name: string;
  email: string;
  role: string;
};

type RegSummary = { payment_status: string }[];

type Status = "loading" | "ready" | "unauthenticated" | "error";

type VideoTutorial = { id: string; title: string; level: string; duration: string };

// Placeholder lessons shown as video frames for now. These will later be
// loaded from the admin (e.g. GET /api/learning/videos) and play real videos.
const VIDEO_TUTORIALS: VideoTutorial[] = [
  { id: "v1", title: "Alphabet & Pronunciation", level: "A1", duration: "12:30" },
  { id: "v2", title: "Greetings & Introductions", level: "A1", duration: "09:45" },
  { id: "v3", title: "Numbers, Dates & Time", level: "A2", duration: "11:10" },
  { id: "v4", title: "Everyday Conversations", level: "A2", duration: "14:05" },
  { id: "v5", title: "Grammar Basics: Verbs", level: "B1", duration: "16:20" },
  { id: "v6", title: "Exam Tips: Hören", level: "B1", duration: "10:00" },
];

export default function LearningPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [regs, setRegs] = useState<RegSummary>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!hasSessionToken()) {
      setStatus("unauthenticated");
      return;
    }
    let cancelled = false;

    Promise.all([
      apiFetch<Me>("/api/me"),
      apiFetch<{ data: RegSummary }>("/api/me/registrations"),
    ])
      .then(([meData, regData]) => {
        if (cancelled) return;
        setMe(meData);
        setRegs(regData.data ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const unpaidCount = regs.filter((r) => r.payment_status !== "Yes").length;
  const firstName = me?.name?.split(" ")[0] ?? "Student";

  if (status === "loading") {
    return (
      <MobileScreen eyebrow="My Learning" title="Loading…">
        <div role="status" aria-label="Loading your profile" className="flex justify-center py-10">
          <MiniSpinner className="size-8" />
        </div>
      </MobileScreen>
    );
  }

  if (status === "unauthenticated") {
    return (
      <MobileScreen eyebrow="My Learning" title="Sign in required">
        <MobileStateCard
          icon={<Lock size={24} strokeWidth={2} />}
          title="You are not signed in"
          description="Sign in to watch your video tutorials and track your progress."
          action={
            <Link href="/sign-in" className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">Sign in</Link>
          }
        />
      </MobileScreen>
    );
  }

  if (status === "error") {
    return (
      <MobileScreen eyebrow="My Learning" title="Something went wrong">
        <MobileStateCard
          icon={<AlertTriangle size={24} strokeWidth={2} />}
          title="Could not load your data"
          description="Please check your connection and try again."
          action={
            <button type="button" onClick={() => setStatus("loading")} className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">Try again</button>
          }
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen
      eyebrow="My Learning"
      title={`Hello, ${firstName}`}
      description="Watch video tutorials from your instructors."
    >
      {unpaidCount > 0 ? (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-[13px] font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300">
          You have {unpaidCount} unpaid course{unpaidCount > 1 ? "s" : ""}.{" "}
          <Link href="/pay" className="underline underline-offset-2">Pay now</Link>
        </div>
      ) : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-app-muted">Video tutorials</h2>
          <span className="text-[12px] font-bold text-app-muted">{VIDEO_TUTORIALS.length} lessons</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {VIDEO_TUTORIALS.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
              <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-slate-800 to-slate-900">
                <span className="grid size-11 place-items-center rounded-full bg-white/95 text-[#0a1224] shadow">
                  <Play size={18} strokeWidth={2} fill="currentColor" />
                </span>
                <span className="absolute left-2 top-2 rounded-full bg-app-accent px-2 py-0.5 text-[10px] font-black text-app-on-accent">{v.level}</span>
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{v.duration}</span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-[13px] font-black leading-tight text-app-text">{v.title}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-app-muted">More lessons added by the admin will appear here.</p>
      </section>

      <MobileCard>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-3xl bg-app-accent text-xl font-black text-app-on-accent">
            {firstName[0]?.toUpperCase() ?? "A"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black text-app-text">{me?.name}</p>
            <p className="truncate text-[13px] text-app-muted">{me?.email}</p>
          </div>
        </div>
      </MobileCard>
    </MobileScreen>
  );
}
