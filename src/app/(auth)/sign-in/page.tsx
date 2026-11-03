"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { apiFetch, saveSessionToken } from "@/lib/apiFetch";
import { useAuth } from "@/lib/auth-provider";

export default function SignInPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
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
      saveSessionToken(token);
      signIn(token, {
        id: data.userId ?? 0,
        email: data.email ?? email.trim(),
        name: null,
        role: data.role ?? "user",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
        <div className="relative">
          <input
            id="signin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={submitting}
            className="focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70 pr-12"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={submitting}
            className="absolute inset-y-0 right-2 flex items-center px-2 text-sm text-app-muted transition hover:text-app-text disabled:opacity-70"
          >
            {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
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
      Forgot your password? <span className="font-black">Contact the school office.</span>
    </p>
    </>
  );
}
