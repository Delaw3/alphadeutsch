"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CircleCheck, MailCheck, RefreshCw } from "lucide-react";

import { apiErrorCode, apiFetch } from "@/lib/apiFetch";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { OTP_LENGTH, OtpCodeInput } from "@/components/mobile/OtpCodeInput";

/** Mirrors VERIFY_RESEND_COOLDOWN_MS on the server (lib/auth/verification.ts). */
const RESEND_COOLDOWN_SECONDS = 60;
/** Mirrors VERIFY_CODE_TTL_MS on the server; used for copy only. */
const CODE_TTL_MINUTES = 10;

/**
 * Server error code -> copy for this screen. The API is deliberately generic
 * about the e-mail address, so every message here talks about the code only.
 */
const CODE_ERRORS: Record<string, string> = {
  "code-invalid": "That code does not match. Check the six digits and try again.",
  "code-expired": "That code has expired. Request a new one below.",
  "code-used": "That code was already used. Request a new one below.",
  "code-attempts-exceeded": "Too many incorrect attempts. Request a new code below.",
  "code-resend-cooldown": "A code was just sent. Please wait before requesting another.",
  "rate-limited": "Too many attempts. Please wait a moment and try again.",
  "provider-error": "We could not send the email. Please try again in a moment.",
};

function errorMessage(error: unknown, fallback: string): string {
  const mapped = CODE_ERRORS[apiErrorCode(error) ?? ""];
  if (mapped) return mapped;
  return error instanceof Error && error.message ? error.message : fallback;
}

/* Shared treatments keep the two steps visually identical. */
const PRIMARY =
  "focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";
const ALERT_ERROR =
  "animate-rise rounded-2xl bg-red-50 px-4 py-2.5 text-center text-[12px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400";
const ALERT_INFO =
  "animate-rise rounded-2xl bg-app-accent/15 px-4 py-2.5 text-center text-[12px] font-bold text-app-text";

export default function VerifyEmailPage() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [notice, setNotice] = useState("");
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Read the query in an effect (not during render) so the page stays statically
  // renderable, exactly like /sign-in and /student-setup.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) {
        setEmail(emailParam);
        setEmailDraft(emailParam);
      } else {
        setEditingEmail(true);
      }
      if (params.get("sent") === "1") setCooldown(RESEND_COOLDOWN_SECONDS);
      if (params.get("notice") === "delivery") {
        setNotice("The first email could not be sent. Tap resend to try again.");
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // One timeout per second instead of a forever-running interval: it stops by
  // itself at zero and cannot keep re-rendering an unmounted screen.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const canResend = Boolean(email) && cooldown === 0 && !resending && !submitting && !sendingCode;

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || verified) return;
    if (code.length !== OTP_LENGTH) {
      setCodeInvalid(true);
      setShaking(true);
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    setError("");
    setInfo("");
    setNotice("");
    setCodeInvalid(false);
    setSubmitting(true);
    try {
      await apiFetch<{ verified: boolean; userId: number }>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setVerified(true);
    } catch (err: unknown) {
      const failure = apiErrorCode(err);
      setError(errorMessage(err, "Verification failed. Please try again."));
      const codeFailure = Boolean(failure?.startsWith("code-"));
      setCodeInvalid(codeFailure);
      setShaking(codeFailure);
      // These states can only be escaped with a fresh code.
      if (failure === "code-expired" || failure === "code-used" || failure === "code-attempts-exceeded") {
        setCooldown(0);
        setInfo("Request a new code to continue.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    setError("");
    setInfo("");
    setNotice("");
    setResending(true);
    try {
      await apiFetch("/api/auth/resend-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setCode("");
      setCodeInvalid(false);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo(`A new code is on its way to ${email}.`);
    } catch (err: unknown) {
      const failure = apiErrorCode(err);
      if (failure === "code-resend-cooldown" || failure === "rate-limited") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
      setError(errorMessage(err, "We could not send a new code. Please try again."));
    } finally {
      setResending(false);
    }
  }

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    if (sendingCode) return;
    const target = emailDraft.trim().toLowerCase();
    if (!target) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setError("");
    setInfo("");
    setNotice("");
    setSendingCode(true);
    try {
      await apiFetch("/api/auth/resend-code", {
        method: "POST",
        body: JSON.stringify({ email: target }),
      });
      setEmail(target);
      setEmailDraft(target);
      setEditingEmail(false);
      setCode("");
      setCodeInvalid(false);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      // Same generic wording as the API: this screen must not reveal whether an
      // account exists for the address.
      setInfo(`If ${target} is registered, a code is on its way.`);
    } catch (err: unknown) {
      const failure = apiErrorCode(err);
      if (failure === "code-resend-cooldown" || failure === "rate-limited") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
      setError(errorMessage(err, "We could not send a code. Please try again."));
    } finally {
      setSendingCode(false);
    }
  }

  function startEmailEdit() {
    setEmailDraft(email);
    setEditingEmail(true);
    setError("");
    setInfo("");
    setNotice("");
  }

  function cancelEmailEdit() {
    setEditingEmail(false);
    setError("");
    setInfo("");
    setNotice("");
  }

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 py-12 text-sm text-app-muted"
      >
        <MiniSpinner />
        Preparing…
      </div>
    );
  }

  if (verified) {
    return (
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="animate-pop grid size-16 place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          <CircleCheck size={30} strokeWidth={2.5} />
        </span>
        <h1 className="animate-rise mt-4 text-xl font-black text-app-text">Email verified</h1>
        <p className="animate-rise mt-2 max-w-[16rem] text-[13px] leading-6 text-app-muted">
          <span className="break-all font-black text-app-text">{email}</span> is confirmed.
        </p>
        <Link
          href={`/sign-in?email=${encodeURIComponent(email)}&notice=verified`}
          className={`animate-rise mt-6 ${PRIMARY}`}
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  if (editingEmail) {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="animate-pop otp-badge"
          >
            <MailCheck size={22} strokeWidth={2.5} />
          </span>
          <h1 className="animate-rise mt-3 text-lg font-black text-app-text">Verify your email</h1>
          <p className="animate-rise mt-1.5 max-w-[17rem] text-[13px] leading-6 text-app-muted">
            We will send a {OTP_LENGTH}-digit code to confirm the address is yours.
          </p>
        </div>

        <form onSubmit={handleSendCode} noValidate className="animate-rise mt-6 grid gap-3">
          <label htmlFor="verify-email-input" className="sr-only">
            Email address
          </label>
          <input
            id="verify-email-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="send"
            required
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="you@example.com"
            disabled={sendingCode}
            className="focus-ring min-h-[52px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-center text-sm font-bold text-app-text placeholder:font-normal placeholder:text-app-muted disabled:opacity-70"
          />

          {error ? (
            <p role="alert" aria-live="polite" className={ALERT_ERROR}>
              {error}
            </p>
          ) : null}
          {notice || info ? (
            <p role="status" aria-live="polite" className={ALERT_INFO}>
              {notice || info}
            </p>
          ) : null}

          <button type="submit" disabled={sendingCode || !emailDraft.trim()} aria-busy={sendingCode} className={PRIMARY}>
            {sendingCode ? (
              <>
                <MiniSpinner />
                Sending code…
              </>
            ) : (
              "Send me a code"
            )}
          </button>

          {email ? (
            <button
              type="button"
              onClick={cancelEmailEdit}
              disabled={sendingCode}
              className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-black text-app-muted transition disabled:opacity-60"
            >
              <ArrowLeft size={13} strokeWidth={2.5} />
              Back to the code
            </button>
          ) : null}
        </form>

        <p className="mt-4 text-center text-[12px] text-app-muted">
          Back to{" "}
          <Link href="/sign-in" className="focus-ring font-black text-app-text underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="animate-pop otp-badge"
        >
          <MailCheck size={22} strokeWidth={2.5} />
        </span>
        <h1 className="animate-rise mt-3 text-lg font-black text-app-text">Verify your email</h1>
        <p className="animate-rise mt-1.5 max-w-[17rem] text-[13px] leading-6 text-app-muted">
          Enter the {OTP_LENGTH}-digit code sent to{" "}
          <span className="break-all font-black text-app-text">{email}</span>
        </p>
        <button
          type="button"
          onClick={startEmailEdit}
          disabled={submitting || resending}
          className="focus-ring mt-1 rounded-full px-2 py-1 text-[12px] font-black text-app-muted underline underline-offset-4 transition hover:text-app-text disabled:opacity-60"
        >
          Use a different email
        </button>
      </div>

      <form onSubmit={handleVerify} noValidate className="mt-5 grid gap-4">
        <div
          className={`mt-1 ${shaking ? "animate-shake" : ""}`}
          onAnimationEnd={() => setShaking(false)}
        >
          <OtpCodeInput
            value={code}
            onChange={(next) => {
              setCode(next);
              setCodeInvalid(false);
              if (error) setError("");
            }}
            disabled={submitting}
            invalid={codeInvalid}
            autoFocus
            describedBy={error ? "verify-code-error" : undefined}
          />
        </div>

        {error ? (
          <p id="verify-code-error" role="alert" aria-live="polite" className={ALERT_ERROR}>
            {error}
          </p>
        ) : null}
        {notice || info ? (
          <p role="status" aria-live="polite" className={ALERT_INFO}>
            {notice || info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || code.length !== OTP_LENGTH}
          aria-busy={submitting}
          className={PRIMARY}
        >
          {submitting ? (
            <>
              <MiniSpinner />
              Verifying…
            </>
          ) : (
            "Verify email"
          )}
        </button>

        <div className="flex items-center justify-center gap-1 text-[12px] text-app-muted">
          <span>{cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it?"}</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend}
            aria-busy={resending}
            className="focus-ring inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-black text-app-text underline underline-offset-4 transition disabled:text-app-muted disabled:no-underline disabled:opacity-70"
          >
            {resending ? <MiniSpinner className="size-3" /> : <RefreshCw size={12} strokeWidth={2.5} />}
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </form>

      <p className="mt-4 text-center text-[11px] leading-5 text-app-muted">
        Expires {CODE_TTL_MINUTES} minutes after sending ·{" "}
        <Link href="/sign-in" className="focus-ring font-black underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
