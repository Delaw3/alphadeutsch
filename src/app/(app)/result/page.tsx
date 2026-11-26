"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { CreditCard, Search } from "lucide-react";
import { siteLinks } from "@/lib/constants";

import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { MobileStateCard, MobileRetryButton } from "@/components/mobile/MobileStates";
import {
  ResultCertificate,
  type CertificateStudent,
} from "@/components/mobile/ResultCertificate";

/* ── Types ── */
type Me = { name: string | null; reg_no?: string | null };

type CourseOption = {
  id: number;
  title: string;
  display: string;
  level: string | null;
};

type ResultData = {
  course_id: number;
  course_title: string;
  sitting: number;
  horen_score: number | null;
  horen_grade: string | null;
  lesen_score: number | null;
  lesen_grade: string | null;
  schreiben_score: number | null;
  schreiben_grade: string | null;
  sprechen_score: number | null;
  sprechen_grade: string | null;
  total_score: number | null;
  overall_grade: string | null;
  student?: CertificateStudent | null;
};

type FetchReason = "not-found" | "unpaid" | "not-registered" | "no-student" | null;

const SITTINGS = [
  { value: 1, label: "1st Sitting" },
  { value: 2, label: "2nd Sitting" },
  { value: 3, label: "3rd Sitting" },
  { value: 4, label: "4th Sitting" },
  { value: 5, label: "5th Sitting" },
] as const;

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "Family Reunion"] as const;

export default function ResultPage() {
  /* Auth guard */
  const [authed] = useState(() => hasSessionToken());

  /* Linked student state */
  const [linked, setLinked] = useState<boolean | null>(null);
  const [verifyRegNo, setVerifyRegNo] = useState("");
  const [verifyDob, setVerifyDob] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  /* Course list */
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesStatus, setCoursesStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  /* Form */
  const [courseId, setCourseId] = useState<number | "">("");
  const [sitting, setSitting] = useState<number>(1);

  /* Result */
  const [result, setResult] = useState<ResultData | null>(null);
  const [reason, setReason] = useState<FetchReason>(null);
  const [resultStatus, setResultStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [resultError, setResultError] = useState<string | null>(null);

  useEffect(() => {
    setCoursesStatus("loading");
    apiFetch<{ data: CourseOption[] }>("/api/courses?open=all")
      .then((d) => {
        setCourses(d.data ?? []);
        setCoursesStatus("ready");
      })
      .catch(() => setCoursesStatus("error"));
  }, [reloadKey]);
  useEffect(() => {
    if (!authed) { setLinked(false); return; }
    let cancelled = false;
    apiFetch<Me>(`/api/me`)
      .then((d) => { if (!cancelled) setLinked(Boolean(d.reg_no)); })
      .catch(() => { if (!cancelled) setLinked(false); });
    return () => { cancelled = true; };
  }, [authed]);


  /* Group courses by level */
  const grouped = useMemo(() => {
    const map = new Map<string, CourseOption[]>();
    for (const level of LEVELS) {
      const group = courses.filter((c) => c.level === level || c.title?.includes(level));
      if (group.length) map.set(level, group);
    }
    // Catch-all for unmatched
    const matched = new Set(courses.filter((c) => LEVELS.some((l) => c.level === l || c.title?.includes(l))).map((c) => c.id));
    const rest = courses.filter((c) => !matched.has(c.id));
    if (rest.length) map.set("Other", rest);
    return map;
  }, [courses]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    setVerifying(true);
    try {
      await apiFetch("/api/me/link-student", {
        method: "POST",
        body: JSON.stringify({ reg_no: verifyRegNo.trim(), dob: verifyDob }),
      });
      setLinked(true);
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Could not verify student details.");
    } finally {
      setVerifying(false);
    }
  }


  async function checkResult(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId) return;
    setResultStatus("loading");
    setResult(null);
    setReason(null);
    setResultError(null);

    try {
      const data = await apiFetch<{ data: ResultData | null; reason?: string }>("/api/me/results", {
        query: { course_id: courseId, sitting },
      });
      setResult(data.data ?? null);
      setReason((data.reason ?? null) as FetchReason);
      setResultStatus("done");
    } catch (err: unknown) {
      setResultError(err instanceof Error ? err.message : "Could not load result.");
      setResultStatus("error");
    }
  }

  if (!authed) {
    return (
      <MobileScreen title="Sign in required">
        <MobileStateCard
          icon="🔒"
          title="You are not signed in"
          description="Sign in to check your exam results."
          action={
            <Link href="/signin" className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">
              Sign in
            </Link>
          }
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen
      title="Check your result"
      description="Select a course and sitting to view your exam scores."
    >
      {!linked ? (
        <MobileCard>
          <h2 className="text-base font-black text-app-text">Verify you&apos;re a student</h2>
          <p className="mt-1 text-[13px] text-app-muted">
            Enter your registration number and date of birth to link your account.
          </p>
          <form onSubmit={handleVerify} className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="verify-regno" className="text-[13px] font-black text-app-text">Registration number</label>
              <input
                id="verify-regno"
                type="text"
                required
                value={verifyRegNo}
                onChange={(e) => setVerifyRegNo(e.target.value)}
                placeholder="e.g. 2022/AD/28087"
                disabled={verifying}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="verify-dob" className="text-[13px] font-black text-app-text">Date of birth</label>
              <input
                id="verify-dob"
                type="date"
                required
                value={verifyDob}
                onChange={(e) => setVerifyDob(e.target.value)}
                disabled={verifying}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text disabled:opacity-70"
              />
            </div>
            {verifyError ? (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {verifyError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={verifying || !verifyRegNo.trim() || !verifyDob}
              className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-60"
            >
              {verifying ? "Verifying…" : "Verify student"}
            </button>
          </form>
        </MobileCard>
      ) : null}

      <MobileCard>
        <form onSubmit={checkResult} className="grid gap-4">
          {/* Course dropdown */}
          <div className="grid gap-1.5">
            <label htmlFor="result-course" className="text-[13px] font-black text-app-text">
              Course
            </label>
            {coursesStatus === "loading" ? (
              <div className="flex min-h-[48px] items-center gap-2 text-sm text-app-muted">
                <MiniSpinner /> Loading courses…
              </div>
            ) : coursesStatus === "error" ? (
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-red-600">Failed to load courses.</span>
                <MobileRetryButton
                  label="Retry"
                  busy={coursesStatus === "error"}
                  onRetry={() => { setCoursesStatus("loading"); setReloadKey((v) => v + 1); }}
                />
              </div>
            ) : (
              <select
                id="result-course"
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
                disabled={!linked}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text disabled:opacity-60"
              >
                <option value="">Select a course…</option>
                {Array.from(grouped.entries()).map(([level, items]) => (
                  <optgroup key={level} label={level}>
                    {items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} — {c.display}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Sitting dropdown */}
          <div className="grid gap-1.5">
            <label htmlFor="result-sitting" className="text-[13px] font-black text-app-text">
              Sitting
            </label>
            <select
              id="result-sitting"
              value={sitting}
              onChange={(e) => setSitting(Number(e.target.value))}
              disabled={!linked}
              className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text disabled:opacity-60"
            >
              {SITTINGS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!linked || !courseId || resultStatus === "loading"}
            aria-busy={resultStatus === "loading"}
            className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-60"
          >
            {resultStatus === "loading" ? <MiniSpinner /> : null}
            {resultStatus === "loading" ? "Checking…" : "Check Result"}
          </button>
        </form>
      </MobileCard>

      {/* Empty course catalogue */}
      {coursesStatus === "ready" && courses.length === 0 ? (
        <MobileStateCard
          icon="📭"
          title="No courses available"
          description="There are no courses to check results for right now. Please check back later."
        />
      ) : null}

      {/* Error state */}
      {resultStatus === "error" && resultError ? (
        <MobileStateCard icon="⚠️" title="Error" description={resultError} />
      ) : null}

      {/* Unpaid */}
      {resultStatus === "done" && reason === "unpaid" ? (
        <MobileStateCard
          icon={<CreditCard size={24} strokeWidth={2} />}
          title="Payment required"
          description="To access your results, you must have fully paid your course fees"
          action={<Link
            href={siteLinks.payment}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent"
          >
            Pay now
          </Link>} />
      ) : null}

      {/* Not found / not registered */}
      {resultStatus === "done" && (reason === "not-found" || reason === "not-registered" || reason === "no-student") ? (
        <MobileStateCard
          icon={<Search size={24} strokeWidth={2} />}
          title="No result found"
          description="No result was found for the selected course and sitting. Please check your selection or contact Alpha Deutsch."
        />
      ) : null}

      {/* Result slip with passport photo, PDF download and PDF sharing */}
      {resultStatus === "done" && result ? (
        <ResultCertificate
          result={result}
          sittingLabel={
            SITTINGS.find((s) => s.value === result.sitting)?.label ?? `Sitting ${result.sitting}`
          }
        />
      ) : null}
    </MobileScreen>
  );
}

