"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { MobileStateCard, MobileRetryButton } from "@/components/mobile/MobileStates";

type Registration = {
  id: number;
  course_id: number;
  course_title: string;
  course_display: string;
  level: string | null;
  payment_status: string;
  date_registered: string | null;
};

type Status = "loading" | "ready" | "empty" | "unauthenticated" | "error";

function PayBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ${
        paid
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      }`}
    >
      {paid ? "Paid" : "Not paid"}
    </span>
  );
}

export default function MyCoursesPage() {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!hasSessionToken()) {
      setStatus("unauthenticated");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    apiFetch<{ data: Registration[] }>("/api/me/registrations")
      .then((d) => {
        if (cancelled) return;
        const rows = d.data ?? [];
        setRegs(rows);
        setStatus(rows.length === 0 ? "empty" : "ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (status === "unauthenticated") {
    return (
      <MobileScreen eyebrow="My Courses" title="Sign in required">
        <MobileStateCard
          icon="🔒"
          title="You are not signed in"
          description="Sign in to view your course registrations."
          action={
            <Link href="/signin" className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">
              Sign in
            </Link>
          }
        />
      </MobileScreen>
    );
  }

  if (status === "loading") {
    return (
      <MobileScreen eyebrow="My Courses" title="Loading…">
        <div role="status" className="flex justify-center py-10">
          <MiniSpinner className="size-8" />
        </div>
      </MobileScreen>
    );
  }

  if (status === "error") {
    return (
      <MobileScreen eyebrow="My Courses" title="Something went wrong">
        <MobileStateCard
          icon="⚠️"
          title="Could not load courses"
          description="Please check your connection and try again."
          action={
            <MobileRetryButton
              onRetry={() => { setStatus("loading"); setReloadKey((v) => v + 1); }}
              label="Try again"
            />
          }
        />
      </MobileScreen>
    );
  }

  if (status === "empty") {
    return (
      <MobileScreen eyebrow="My Courses" title="No registrations yet">
        <MobileStateCard
          icon="📚"
          title="No courses yet"
          description="You have not registered for any course yet."
          action={
            <Link href="/register" className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">
              Register for a course
            </Link>
          }
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen
      eyebrow="My Courses"
      title="Your registrations"
      description={`${regs.length} course${regs.length !== 1 ? "s" : ""} found.`}
    >
      <div className="grid gap-3">
        {regs.map((reg) => (
          <MobileCard key={reg.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {reg.level ? (
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">
                    {reg.level}
                  </p>
                ) : null}
                <h3 className="mt-0.5 truncate font-black text-app-text">
                  {reg.course_title || `Course #${reg.course_id}`}
                </h3>
                {reg.course_display ? (
                  <p className="mt-0.5 text-[13px] text-app-muted">{reg.course_display}</p>
                ) : null}
                {reg.date_registered ? (
                  <p className="mt-1 text-[12px] text-app-muted">
                    Registered:{" "}
                    {new Date(reg.date_registered).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
              <PayBadge paid={reg.payment_status === "Yes"} />
            </div>
            {reg.payment_status !== "Yes" ? (
              <Link
                href="/pay"
                className="focus-ring mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-app-accent text-[13px] font-black text-app-on-accent transition active:scale-[0.98]"
              >
                Pay now
              </Link>
            ) : null}
          </MobileCard>
        ))}
      </div>
    </MobileScreen>
  );
}

