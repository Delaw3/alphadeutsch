"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { siteLinks } from "@/lib/constants";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { MobileStateCard } from "@/components/mobile/MobileStates";

type Me = { name: string | null; email: string; phone?: string | null; reg_no?: string | null };

type CourseRow = {
  id: number;
  title: string;
  display: string;
  price: string;
  is_open: number;
};

type Step =
  | "loading"
  | "form"
  | "details"
  | "confirm"
  | "submitting"
  | "success"
  | "unauthenticated"
  | "error";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_APP_REGISTRATION === "true";
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "Family Reunion"] as const;

function levelOf(title: string): string {
  if (title.startsWith("Family")) return "Family Reunion";
  return title.split(" ")[0] ?? title;
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [linked, setLinked] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [courseId, setCourseId] = useState<number | "">("");

  const [regNo, setRegNo] = useState("");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [dob, setDob] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [successRegNo, setSuccessRegNo] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSessionToken()) {
      setStep("unauthenticated");
      return;
    }
    let cancelled = false;
    Promise.all([
      apiFetch<Me>("/api/me"),
      apiFetch<{ data: CourseRow[] }>("/api/courses"),
    ])
      .then(([meData, courseData]) => {
        if (cancelled) return;
        setMe(meData);
        setLinked(Boolean(meData.reg_no));
        setFullname(meData.name ?? "");
        setEmail(meData.email ?? "");
        setPhone(meData.phone ?? "");
        setCourses(courseData.data ?? []);
        setStep("form");
      })
      .catch(() => {
        if (!cancelled) setStep("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, CourseRow[]>();
    for (const level of LEVELS) {
      const items = courses.filter(
        (c) => levelOf(c.title) === level && c.is_open === 1,
      );
      if (items.length) map.set(level, items);
    }
    const matched = new Set(
      courses
        .filter((c) => LEVELS.includes(levelOf(c.title) as (typeof LEVELS)[number]))
        .map((c) => c.id),
    );
    const rest = courses.filter((c) => c.is_open === 1 && !matched.has(c.id));
    if (rest.length) map.set("Other", rest);
    return map;
  }, [courses]);

  const selectedCourse = courses.find((c) => c.id === courseId);

  function handleSelectCourse(id: number) {
    setCourseId(id);
    setError(null);
  }

  function handleContinue() {
    if (!courseId) {
      setError("Please select a course.");
      return;
    }
    setError(null);
    if (linked) {
      setStep("confirm");
    } else {
      setStep("details");
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!courseId) {
      setError("Please select a course.");
      return;
    }
    if (!linked) {
      if (!regNo.trim() || !fullname.trim() || !email.trim() || !phone.trim() || !placeOfBirth.trim() || !dob) {
        setError("Please fill in all required student details.");
        setStep("details");
        return;
      }
    }
    setStep("submitting");
    try {
      if (!FEATURE_ENABLED) {
        window.open(siteLinks.registration, "_blank", "noopener,noreferrer");
        setStep("form");
        return;
      }
      const body: Record<string, unknown> = { course_id: courseId };
      if (!linked) {
        body.reg_no = regNo.trim();
        body.fullname = fullname.trim();
        body.email = email.trim();
        body.phone = phone.trim();
        body.place_of_birth = placeOfBirth.trim();
        body.dob = dob;
      }
      const data = await apiFetch<{ message?: string; reg_no?: string }>(
        "/api/me/registrations",
        { method: "POST", body: JSON.stringify(body) },
      );
      setSuccessRegNo(data?.reg_no ?? (linked ? me?.reg_no ?? null : regNo.trim()));
      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      setStep(linked ? "confirm" : "details");
    }
  }

  if (step === "unauthenticated") {
    return (
      <MobileScreen eyebrow="Register" title="Sign in required">
        <MobileStateCard
          icon="🔒"
          title="You are not signed in"
          description="Sign in to register for a course."
          action={
            <Link
              href="/sign-in"
              className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent"
            >
              Sign in
            </Link>
          }
        />
      </MobileScreen>
    );
  }

  if (step === "loading") {
    return (
      <MobileScreen eyebrow="Register" title="Loading…">
        <div className="flex justify-center py-10">
          <MiniSpinner className="size-8" />
        </div>
      </MobileScreen>
    );
  }

  if (step === "error") {
    return (
      <MobileScreen eyebrow="Register" title="Something went wrong">
        <MobileStateCard icon="⚠️" title="Could not load form" description="Please try again later." />
      </MobileScreen>
    );
  }

  if (step === "success") {
    const rn = successRegNo;
    return (
      <MobileScreen eyebrow="Register" title="Registration submitted">
        <MobileCard>
          <div className="grid gap-3 text-center">
            <span aria-hidden="true" className="text-4xl">✅</span>
            <p className="text-[13px] text-app-muted">Your registration number:</p>
            <p className="text-lg font-black text-app-text">{rn || "—"}</p>
            {rn ? (
              <Link
                href={siteLinks.payment}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98]"
              >
                Pay now
              </Link>
            ) : null}
          </div>
        </MobileCard>
      </MobileScreen>
    );
  }

  if (step === "details") {
    return (
      <MobileScreen
        eyebrow="Register"
        title="Student details"
        description="Tell us a bit about you to complete registration."
      >
        <MobileCard>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="reg-regno" className="text-[13px] font-black text-app-text">
                Registration number *
              </label>
              <input
                id="reg-regno"
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="reg-fullname" className="text-[13px] font-black text-app-text">
                Full name *
              </label>
              <input
                id="reg-fullname"
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="reg-email" className="text-[13px] font-black text-app-text">
                Email *
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="reg-phone" className="text-[13px] font-black text-app-text">
                Phone *
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="reg-pob" className="text-[13px] font-black text-app-text">
                Place of birth *
              </label>
              <input
                id="reg-pob"
                type="text"
                value={placeOfBirth}
                onChange={(e) => setPlaceOfBirth(e.target.value)}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="reg-dob" className="text-[13px] font-black text-app-text">
                Date of birth *
              </label>
              <input
                id="reg-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text"
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-app-border text-[13px] font-black text-app-text"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-app-accent text-[13px] font-black text-app-on-accent"
              >
                Continue
              </button>
            </div>
          </div>
        </MobileCard>
      </MobileScreen>
    );
  }

  if (step === "confirm") {
    return (
      <MobileScreen eyebrow="Register" title="Confirm registration">
        <MobileCard>
          <div className="grid gap-3">
            <p className="text-[13px] text-app-muted">
              Course:{" "}
              <span className="font-black text-app-text">
                {selectedCourse?.title} — {selectedCourse?.display}
              </span>
            </p>
            <p className="text-[13px] text-app-muted">
              Price: <span className="font-black text-app-text">{selectedCourse?.price}</span>
            </p>
            {!linked ? (
              <p className="text-[13px] text-app-muted">
                Student: <span className="font-black text-app-text">{fullname}</span>
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep(linked ? "form" : "details")}
                className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-app-border text-[13px] font-black text-app-text"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-app-accent text-[13px] font-black text-app-on-accent"
              >
                {FEATURE_ENABLED ? "Confirm & register" : "Open registration page"}
              </button>
            </div>
            {!FEATURE_ENABLED ? (
              <p className="text-[12px] text-app-muted">
                App registration is not yet available. The button opens the school&apos;s registration page.
              </p>
            ) : null}
          </div>
        </MobileCard>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen
      eyebrow="Register"
      title="Register for a course"
      description="Choose an open course to register."
    >
      {grouped.size === 0 ? (
        <MobileStateCard icon="📭" title="No open courses" description="There are no open courses right now." />
      ) : (
        <div className="grid gap-4">
          {Array.from(grouped.entries()).map(([level, items]) => (
            <MobileCard key={level}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">{level}</p>
              <div className="mt-2 grid gap-2">
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCourse(c.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      courseId === c.id
                        ? "border-app-accent bg-app-surface-2"
                        : "border-app-border bg-app-surface"
                    }`}
                  >
                    <span className="text-[13px] font-black text-app-text">{c.display}</span>
                    <span className="text-[13px] font-bold text-app-muted">{c.price}</span>
                  </button>
                ))}
              </div>
            </MobileCard>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!courseId}
        onClick={handleContinue}
        className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-60"
      >
        Continue
      </button>
    </MobileScreen>
  );
}
