"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";

import { apiFetch } from "@/lib/apiFetch";
import { passwordRequirementMessage } from "@/lib/auth/password-rules";
import { PasswordInput } from "@/components/mobile/PasswordInput";

export default function StudentSetupPage() {
  const [email, setEmail] = useState("");
  const [regNo, setRegNo] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const e = new URLSearchParams(window.location.search).get("email");
      if (e) setEmail(e);
    } catch {
      /* ignore */
    }
  }, []);

  const mismatch = confirm.length > 0 && confirm !== password;
  // Same shared rule the API enforces, so the hint names only what is missing.
  const passwordMessage = password.length > 0 ? passwordRequirementMessage(password) : null;
  const passwordValid = password.length > 0 && passwordMessage === null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch<{ email: string; message: string }>("/api/auth/student-setup", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), reg_no: regNo.trim(), dob, password }),
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not set up your mobile login.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="text-lg font-black text-app-text">Mobile login created</h1>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          Sign in with <span className="font-black text-app-text">{email}</span> and the new password you just chose.
        </p>
        <Link href={`/sign-in?email=${encodeURIComponent(email)}&notice=setup`} className="focus-ring mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-app-accent text-sm font-black text-app-on-accent">
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="flex items-center gap-2 text-lg font-black text-app-text">
        <CircleCheck aria-hidden="true" strokeWidth={2.5} className="size-5 shrink-0 text-green-600" />
        You&apos;re already a student
      </h1>
      <p className="mt-1 text-sm leading-6 text-app-muted">
        Your record is already with us. Enter the details you registered with and choose a password to complete your mobile login.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 grid gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="su-email" className="text-[13px] font-black text-app-text">Email address</label>
          <input id="su-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="su-regno" className="text-[13px] font-black text-app-text">Registration number</label>
          <input id="su-regno" type="text" required value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="e.g. 2022/AD/28087" disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="su-dob" className="text-[13px] font-black text-app-text">Date of birth</label>
          <input id="su-dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text disabled:opacity-70" />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="su-password" className="text-[13px] font-black text-app-text">New password</label>
          <PasswordInput id="su-password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 chars: upper, lower, digit, symbol" disabled={submitting} aria-describedby={passwordMessage ? "su-password-hint" : undefined} />
          {passwordMessage ? <p id="su-password-hint" className="mt-1 text-[12px] text-app-muted">{passwordMessage}</p> : null}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="su-confirm" className="text-[13px] font-black text-app-text">Confirm password</label>
          <PasswordInput id="su-confirm" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={submitting} />
          {mismatch ? <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">Passwords do not match.</p> : null}
        </div>

        {error ? (
          <p role="alert" aria-live="polite" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
        ) : null}

        <button type="submit" disabled={submitting || !passwordValid || mismatch || !email.trim() || !regNo.trim() || !dob || !confirm} aria-busy={submitting} className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
          {submitting ? "Creating login..." : "Create mobile login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-app-muted">
        Back to <Link href="/sign-in" className="focus-ring font-black text-app-text underline underline-offset-4">Sign in</Link>
      </p>
    </>
  );
}
