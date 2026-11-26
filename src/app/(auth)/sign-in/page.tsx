"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiErrorCode, apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/lib/auth-provider";
import { PasswordInput } from "@/components/mobile/PasswordInput";

/** Short, human-readable explanations for the ?notice= values other auth pages link here with. */
const NOTICES: Record<string, string> = {
  exists: "This email is already registered. Sign in to continue.",
  created: "Your account was created. Sign in to continue.",
  setup: "Your mobile login was created. Sign in with your new password.",
  verified: "Email verified. Sign in with your password to continue.",
  reset: "Password updated. Sign in with your new password.",
};

export default function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prefill the email and explain why we were redirected here (read from the
  // URL in an effect so the page stays statically renderable).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) setEmail(emailParam);
      const noticeParam = params.get("notice");
      if (noticeParam) setNotice(NOTICES[noticeParam] ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setNeedsVerify(false);
    setSubmitting(true);
    try {
      const data = await apiFetch<{
        sessionToken?: string;
        userId?: number;
        email?: string;
        role?: string;
      }>("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const token = data?.sessionToken;
      if (!token) throw new Error("No session token returned.");
      // signIn() persists the token (token-store) and flips the app to
      // "authenticated"; the auth guard then performs the single transition to
      // /home. Keep the button in its "Signing in…" state until that happens —
      // re-enabling it made a slow transition look like a failed sign-in.
      signIn(token, {
        id: data.userId ?? 0,
        email: data.email ?? email.trim(),
        name: null,
        role: data.role ?? "user",
      });
    } catch (err: unknown) {
      // A 403 with this code means the password was right but the e-mail is
      // not confirmed: offer the verification screen instead of a dead end.
      setNeedsVerify(apiErrorCode(err) === "email-not-verified");
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      {notice ? (
        <p role="status" aria-live="polite" className="mb-4 rounded-2xl bg-green-50 px-4 py-3 text-[13px] font-bold text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {notice}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="signin-email" className="text-[13px] font-black text-app-text">
          Email address
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="next"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={submitting}
          className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70"
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="signin-password" className="text-[13px] font-black text-app-text">
          Password
        </label>
        <PasswordInput
          id="signin-password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={submitting}
        />
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {needsVerify ? (
        <Link
          href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
          className="focus-ring inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-app-border bg-app-surface-2 text-sm font-black text-app-text transition active:scale-[0.98]"
        >
          Verify my email
        </Link>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <span className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>

    <p className="mt-6 text-center text-sm text-app-muted">
      {"Don't have an account? "}
      <Link
        href="/sign-up"
        className="focus-ring font-black text-app-text underline underline-offset-4"
      >
        Create account
      </Link>
    </p>
    <p className="text-center text-sm text-app-muted">
      Forgot your password?{" "}
      <Link
        href="/forgot-password"
        className="focus-ring font-black text-app-text underline underline-offset-4"
      >
        Reset it
      </Link>
    </p>
    </>
  );
}
