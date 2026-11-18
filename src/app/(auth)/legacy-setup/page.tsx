"use client";

import Link from "next/link";
import { useState } from "react";

import { apiFetch } from "@/lib/apiFetch";

export default function LegacySetupPage() {
  const [regNo, setRegNo] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const data = await apiFetch<{ email: string; message: string }>("/api/auth/legacy-setup", {
        method: "POST",
        body: JSON.stringify({ reg_no: regNo.trim(), dob, password }),
      });
      setDoneEmail(data.email ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not set up your mobile login.");
    } finally {
      setSubmitting(false);
    }
  }

  if (doneEmail !== null) {
    return (
      <>
        <h1 className="text-lg font-black text-app-text">Mobile login created 🎉</h1>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          Your existing website password now works in the app. Sign in with your email
          {doneEmail ? (
            <>
              {" "}
              (<span className="font-black text-app-text">{doneEmail}</span>)
            </>
          ) : null}{" "}
          and the password you just entered.
        </p>
        <Link
          href="/sign-in"
          className="focus-ring mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-app-accent text-sm font-black text-app-on-accent"
        >
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-black text-app-text">Set up your mobile login</h1>
      <p className="mt-1 text-sm leading-6 text-app-muted">
        Already a student on our website? Enter your registration number, date of birth, and your
        existing website password to create your app login.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 grid gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="legacy-regno" className="text-[13px] font-black text-app-text">
            Registration number
          </label>
          <input
            id="legacy-regno"
            type="text"
            required
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            placeholder="e.g. 2022/AD/28087"
            disabled={submitting}
            className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="legacy-dob" className="text-[13px] font-black text-app-text">
            Date of birth
          </label>
          <input
            id="legacy-dob"
            type="date"
            required
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            disabled={submitting}
            className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text disabled:opacity-70"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="legacy-password" className="text-[13px] font-black text-app-text">
            Existing website password
          </label>
          <input
            id="legacy-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your current password on the website"
            disabled={submitting}
            className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70"
          />
        </div>

        {error ? (
          <p role="alert" aria-live="polite" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !regNo.trim() || !dob || !password}
          aria-busy={submitting}
          className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {submitting ? "Setting up…" : "Set up mobile login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-app-muted">
        Back to{" "}
        <Link href="/sign-in" className="focus-ring font-black text-app-text underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
