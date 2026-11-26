"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiErrorCode, apiFetch } from "@/lib/apiFetch";
import { passwordRequirementMessage } from "@/lib/auth/password-rules";
import { PasswordInput } from "@/components/mobile/PasswordInput";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      const signupRes = await apiFetch<{ message?: string; needsStudentSetup?: boolean; email?: string }>(
        "/api/auth/signup",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: trimmedEmail, password }),
        },
      );
      if (signupRes?.needsStudentSetup) {
        router.push(`/student-setup?email=${encodeURIComponent(signupRes.email ?? trimmedEmail)}`);
        return;
      }
      if (signupRes?.message === "already registered, please sign in") {
        // Carry the reason + email to /sign-in so the user sees why they were
        // sent there instead of a silent redirect with the error left behind.
        router.push(`/sign-in?email=${encodeURIComponent(trimmedEmail)}&notice=exists`);
        return;
      }
      // Signup issues a six-digit code. Verification comes before the first
      // sign-in, so hand the address to the OTP screen instead of silently
      // signing in with an unverified e-mail. `sent=1` starts the resend
      // countdown because the first code has just been delivered.
      router.push(`/verify-email?email=${encodeURIComponent(trimmedEmail)}&sent=1`);
    } catch (err: unknown) {
      if (apiErrorCode(err) === "provider-error") {
        // The account exists but the first e-mail failed. The verification
        // screen can request a fresh code, so the user is never stranded.
        router.push(`/verify-email?email=${encodeURIComponent(trimmedEmail)}&notice=delivery`);
        return;
      }
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Same shared rule the API enforces: name only what is actually missing.
  const passwordMessage = password.length > 0 ? passwordRequirementMessage(password) : null;
  const passwordValid = password.length > 0 && passwordMessage === null;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="signup-name" className="text-[13px] font-black text-app-text">Full name</label>
          <input id="signup-name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} aria-describedby="signup-name-hint" className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
          <p id="signup-name-hint" className="text-[12px] leading-5 text-app-muted">
            Surname, First name, Other name
          </p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="signup-email" className="text-[13px] font-black text-app-text">Email address</label>
          <input id="signup-email" type="email" autoComplete="email" inputMode="email" enterKeyHint="next" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="signup-password" className="text-[13px] font-black text-app-text">Password</label>
          <PasswordInput id="signup-password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters, upper/lower/digit/symbol" disabled={submitting} aria-describedby={passwordMessage ? "signup-password-hint" : undefined} />
          {passwordMessage ? <p id="signup-password-hint" className="mt-1 text-[12px] text-app-muted">{passwordMessage}</p> : null}
        </div>
        {error ? (
          <p role="alert" aria-live="polite" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
        ) : null}
        <button type="submit" disabled={submitting || !passwordValid} aria-busy={submitting} className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
          {submitting ? (<><span className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> Creating account…</>) : "Create account"}
        </button>
        <p className="text-center text-[12px] leading-5 text-app-muted">
          We will e-mail you a 6-digit code to confirm your address before your first sign-in.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-app-muted">Already have an account?{" "}
        <Link href="/sign-in" className="focus-ring font-black text-app-text underline underline-offset-4">Sign in</Link>
      </p>
    </>
  );
}
