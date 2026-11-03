"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Search, Wifi, AlertTriangle } from "lucide-react";
import { MobileRetryButton, MobileStateCard } from "@/components/mobile/MobileStates";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { fetchMobileCourse, formatNaira, isOfflineError, type MobileCourseRow } from "@/lib/mobile-api";
type Status = "loading" | "ready" | "missing" | "offline" | "error";
export default function MobileCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const courseId = Number(id);
  const [course, setCourse] = useState<MobileCourseRow | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const retrying = status === "loading";
  useEffect(() => {
    if (!Number.isInteger(courseId) || courseId <= 0) { setStatus("missing"); return; }
    const controller = new AbortController();
    setStatus("loading");
    fetchMobileCourse(courseId, controller.signal).then((row) => {
      if (row === null) setStatus("missing");
      else { setCourse(row); setStatus("ready"); }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setStatus(isOfflineError(error) ? "offline" : "error");
    });
    return () => controller.abort();
  }, [courseId, reloadKey]);
  if (status === "loading") {
    return (<MobileScreen eyebrow="Course details" title="Loading course…"><MobileCard><div role="status" aria-live="polite" aria-label="Loading course details" className="animate-pulse"><div className="h-4 w-24 rounded-full bg-app-surface-2" /><div className="mt-3 h-6 w-3/4 rounded-full bg-app-surface-2" /><div className="mt-3 h-3 w-full rounded-full bg-app-surface-2" /><div className="mt-4 h-12 w-full rounded-full bg-app-surface-2" /></div></MobileCard></MobileScreen>);
  }
  if (status === "missing") {
    return (<MobileScreen eyebrow="Course details" title="Course not found"><MobileStateCard title="Course not found" description="This course does not exist or is no longer available." icon={<Search size={24} strokeWidth={2} />} action={<Link href="/courses" className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">Back to courses</Link>} /></MobileScreen>);
  }
  if (status === "offline") {
    return (<MobileScreen eyebrow="Course details" title="You are offline"><MobileStateCard title="You are offline" description="Connect to the internet to load live course details." icon={<Wifi size={24} strokeWidth={2} />} action={<MobileRetryButton busy={retrying} onRetry={() => { setStatus("loading"); setReloadKey((v) => v + 1); }} />} /></MobileScreen>);
  }
  if (status === "error" || !course) {
    return (<MobileScreen eyebrow="Course details" title="Details unavailable"><MobileStateCard title="Details unavailable" description="We could not load this course right now. Please try again later." icon={<AlertTriangle size={24} strokeWidth={2} />} action={<MobileRetryButton busy={retrying} onRetry={() => { setStatus("loading"); setReloadKey((v) => v + 1); }} />} /></MobileScreen>);
  }
  const closed = course.is_open !== 1;
  return (
    <MobileScreen eyebrow={`${course.title} · ${course.display}`} title={course.title}
      description="Database-backed course information. Registration and payment remain in person until secure account access launches."
      action={<Link href="/courses" className="focus-ring inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface-2 px-4 text-[13px] font-black text-app-text">← All</Link>}>
      <MobileCard>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{course.display}</p>
        <p className="mt-2 text-3xl font-black tabular-nums text-app-text">{formatNaira(course.price)}</p>
        <p className="mt-3 text-sm leading-6 text-app-muted">{course.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}</p>
        {closed ? (<p role="status" className="mt-4 border border-app-border bg-app-surface-2 p-4 text-sm font-bold text-app-muted">This course is currently closed and not available for registration.</p>)
        : (<p role="status" className="mt-4 border-l-4 border-app-accent bg-app-surface-2 p-4 text-sm font-bold text-app-text">This course is open. Visit Alpha Deutsch in person for registration and offline payment guidance.</p>)}
      </MobileCard>
      <Link href="/courses" className="focus-ring inline-flex min-h-[52px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">Back to catalogue</Link>
    </MobileScreen>
  );
}
