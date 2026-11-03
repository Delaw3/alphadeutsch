"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch, saveSessionToken } from "@/lib/apiFetch";
import { useAuth } from "@/lib/auth-provider";

export default function SignUpPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const signupRes = await apiFetch<{ message?: string }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      if (signupRes?.message === "already registered, please sign in") {
        setError("This email is already registered. Please sign in.");
        router.push("/sign-in");
        return;
      }
      setSuccess("Account created successfully. Logging you in…");
      try {
        const data = await apiFetch<{ sessionToken?: string; userId?: number; email?: string; role?: string }>(
          "/api/auth/signin",
          {
            method: "POST",
            body: JSON.stringify({ email: email.trim(), password }),
          }
        );
        const token = data?.sessionToken;
        if (!token) throw new Error("No session token returned.");
        saveSessionToken(token);
        signIn(token, {
          id: data.userId ?? 0,
          email: data.email ?? email.trim(),
          name: name.trim() || null,
          role: data.role ?? "user",
        });
      } catch {
        setSuccess("Account created. Please sign in to continue.");
        router.push("/sign-in");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const tooShort = password.length > 0 && password.length < 10;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="signup-name" className="text-[13px] font-black text-app-text">Full name</label>
          <input id="signup-name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chukwuemeka Obi" disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="signup-email" className="text-[13px] font-black text-app-text">Email address</label>
          <input id="signup-email" type="email" autoComplete="email" inputMode="email" enterKeyHint="next" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="signup-password" className="text-[13px] font-black text-app-text">Password</label>
          <input id="signup-password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters, upper/lower/digit/symbol" disabled={submitting} className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70" />
          {tooShort ? <p className="mt-1 text-[12px] text-app-muted">Password must be 10+ chars with upper, lower, digit, and symbol.</p> : null}
        </div>
        {error ? (
          <p role="alert" aria-live="polite" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
        ) : null}
        {success ? (
          <p role="status" aria-live="polite" className="rounded-2xl bg-green-50 px-4 py-3 text-[13px] font-bold text-green-700 dark:bg-green-900/20 dark:text-green-400">{success}</p>
        ) : null}
        <button type="submit" disabled={submitting || tooShort} aria-busy={submitting} className="focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
          {submitting ? (<><span className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> Creating account…</>) : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-app-muted">Already have an account?{" "}
        <Link href="/sign-in" className="focus-ring font-black text-app-text underline underline-offset-4">Sign in</Link>
      </p>
    </>
  );
}
