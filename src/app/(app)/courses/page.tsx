"use client";

import { useEffect, useMemo, useState } from "react";

import { MobileCourseCard } from "@/components/mobile/MobileCourseCard";
import { MobileLoadingList, MobileRetryButton, MobileStateCard } from "@/components/mobile/MobileStates";
import { MobileScreen } from "@/components/mobile/MobileScreen";
import { fetchOpenCourses, isOfflineError, type MobileCourseRow } from "@/lib/mobile-api";

type Status = "loading" | "ready" | "empty" | "offline" | "error";

const modes = ["All", "On-Site", "Online", "Private", "Online Private"] as const;

export default function MobileCoursesPage() {
  const [courses, setCourses] = useState<MobileCourseRow[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<(typeof modes)[number]>("All");
  const [reloadKey, setReloadKey] = useState(0);
  const retrying = status === "loading";

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchOpenCourses(controller.signal)
      .then((rows) => {
        setCourses(rows);
        setStatus(rows.length === 0 ? "empty" : "ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus(isOfflineError(error) ? "offline" : "error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  const visible = useMemo(() => {
    if (mode === "All") return courses;
    return courses.filter((course) => course.display === mode);
  }, [courses, mode]);

  return (
    <MobileScreen
      eyebrow="Course catalogue"
      title="Open German courses"
      description="Live Alpha Deutsch levels, learning modes, and prices from the courses catalogue. Closed courses stay unavailable for registration."
    >
      <div
        role="tablist"
        aria-label="Filter courses by learning mode"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {modes.map((item) => {
          const active = item === mode;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(item)}
              className={`focus-ring inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-black transition active:scale-[0.98] ${
                active
                  ? "bg-app-accent text-app-on-accent"
                  : "bg-app-surface text-app-muted ring-1 ring-app-border"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      {status === "loading" ? <MobileLoadingList /> : null}

      {status === "ready" ? (
        visible.length === 0 ? (
          <MobileStateCard
            title="No courses for this mode"
            description="Try another learning mode, or check the full open catalogue again."
            icon="🔍"
          />
        ) : (
          <div className="grid gap-3">
            {visible.map((course) => (
              <MobileCourseCard key={course.id} course={course} />
            ))}
          </div>
        )
      ) : null}

      {status === "empty" ? (
        <MobileStateCard
          title="No open courses right now"
          description="There are currently no courses open for registration. Please check back soon."
          icon="📚"
          action={<MobileRetryButton busy={retrying} onRetry={() => { setStatus("loading"); setReloadKey((value) => value + 1); }} label="Refresh" />}
        />
      ) : null}

      {status === "offline" ? (
        <MobileStateCard
          title="You are offline"
          description="The catalogue needs an internet connection because prices are loaded from the live backend."
          icon="📶"
          action={<MobileRetryButton busy={retrying} onRetry={() => { setStatus("loading"); setReloadKey((value) => value + 1); }} />}
        />
      ) : null}

      {status === "error" ? (
        <MobileStateCard
          title="Course catalogue unavailable"
          description="We could not load the live course list. Please try again later."
          icon="⚠️"
          action={<MobileRetryButton busy={retrying} onRetry={() => { setStatus("loading"); setReloadKey((value) => value + 1); }} />}
        />
      ) : null}
    </MobileScreen>
  );
}
