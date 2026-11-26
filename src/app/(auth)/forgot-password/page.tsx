"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CircleCheck, KeyRound, MailCheck, RefreshCw } from "lucide-react";

import { apiErrorCode, apiFetch } from "@/lib/apiFetch";
import { passwordRequirementMessage } from "@/lib/auth/password-rules";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { OTP_LENGTH, OtpCodeInput } from "@/components/mobile/OtpCodeInput";
import { PasswordInput } from "@/components/mobile/PasswordInput";

/** Mirrors the server's resend cooldown and reset-ticket lifetime. */
const RESEND_COOLDOWN_SECONDS = 60;
const TICKET_TTL_MINUTES = 15;

const CODE_ERRORS: Record<string, string> = {
  "code-invalid": "That code does not match. Check the six digits and try again.",
  "code-expired": "That code has expired. Request a new one.",
  "code-used": "That code was already used. Request a new one.",
  "code-attempts-exceeded": "Too many incorrect attempts. Request a new code.",
  "code-resend-cooldown": "A code was just sent. Please wait before requesting another.",
  "reset-token-invalid": "Your reset session expired. Please start again.",
  "account-not-found": "No account was found with that email address.",
  "email-not-verified": "This email is not verified yet. Verify it first, then reset your password.",
  "rate-limited": "Too many attempts. Please wait a moment and try again.",
  "provider-error": "We could not send the email. Please try again in a moment.",
};

function errorMessage(error: unknown, fallback: string): string {
  const mapped = CODE_ERRORS[apiErrorCode(error) ?? ""];
  if (mapped) return mapped;
  return error instanceof Error && error.message ? error.message : fallback;
}

const PRIMARY =
  "focus-ring inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-app-accent text-sm font-black text-app-on-accent transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";
const ALERT_ERROR =
  "animate-rise rounded-2xl bg-red-50 px-4 py-2.5 text-center text-[12px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400";
const ALERT_INFO =
  "animate-rise rounded-2xl bg-app-accent/15 px-4 py-2.5 text-center text-[12px] font-bold text-app-text";

type Step = "email" | "code" | "password" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [notice, setNotice] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const passwordMessage = password.length > 0 ? passwordRequirementMessage(password) : null;
  const passwordValid = password.length > 0 && passwordMessage === null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canResend = cooldown === 0 && !sending && Boolean(email);

  async function requestCode(target: string) {
    const response = await apiFetch<{ message?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: target }),
    });
    setEmail(target);
    setCode("");
    setCodeInvalid(false);
    setStep("code");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setInfo(response?.message ?? "If that account can be reset, a code has been sent.");
  }

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const target = emailDraft.trim().toLowerCase();
    if (!target) {
      setError("Enter the email address on your account.");
      return;
    }
    setError("");
    setInfo("");
    setNotice("");
    setVerifyEmail("");
    setSending(true);
    try {
      await requestCode(target);
    } catch (err: unknown) {
      setVerifyEmail(apiErrorCode(err) === "email-not-verified" ? target : "");
      setError(errorMessage(err, "We could not start the reset. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    setError("");
    setInfo("");
    setSending(true);
    try {
      await requestCode(email);
    } catch (err: unknown) {
      setVerifyEmail(apiErrorCode(err) === "email-not-verified" ? email : "");
      setError(errorMessage(err, "We could not send a new code. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (verifying) return;
    if (code.length !== OTP_LENGTH) {
      setCodeInvalid(true);
      setShaking(true);
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    setError("");
    setInfo("");
    setCodeInvalid(false);
    setVerifying(true);
    try {
      const result = await apiFetch<{ ticket?: string }>("/api/auth/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      if (!result?.ticket) throw new Error("No reset ticket returned.");
      setTicket(result.ticket);
      setStep("password");
    } catch (err: unknown) {
      const failure = apiErrorCode(err);
      const codeFailure = Boolean(failure?.startsWith("code-"));
      setCodeInvalid(codeFailure);
      setShaking(codeFailure);
      setError(errorMessage(err, "We could not verify that code. Please try again."));
    } finally {
      setVerifying(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!passwordValid) {
      setError(passwordMessage ?? "Choose a stronger password.");
      return;
    }
    setError("");
    setInfo("");
    setSaving(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, ticket, password }),
      });
      setStep("done");
    } catch (err: unknown) {
      const failure = apiErrorCode(err);
      if (failure === "reset-token-invalid") {
        // The 15-minute ticket is gone: restart at the e-mail step.
        setStep("email");
        setTicket("");
        setCode("");
        setEmailDraft(email);
        setNotice("Your reset session expired. Request a new code to continue.");
      } else {
        setError(errorMessage(err, "We could not update the password. Please try again."));
      }
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    setStep("email");
    setCode("");
    setTicket("");
    setPassword("");
    setConfirm("");
    setError("");
    setInfo("");
    setCooldown(0);
    setEmailDraft(email);
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="animate-pop grid size-16 place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          <CircleCheck size={30} strokeWidth={2.5} />
        </span>
        <h1 className="animate-rise mt-4 text-xl font-black text-app-text">Password updated</h1>
        <p className="animate-rise mt-2 max-w-[16rem] text-[13px] leading-6 text-app-muted">
          Sign in with your new password for{" "}
          <span className="break-all font-black text-app-text">{email}</span>.
        </p>
        <Link
          href={`/sign-in?email=${encodeURIComponent(email)}&notice=reset`}
          className={`animate-rise mt-6 ${PRIMARY}`}
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  if (step === "password") {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="animate-pop otp-badge">
            <KeyRound size={22} strokeWidth={2.5} />
          </span>
          <h1 className="animate-rise mt-3 text-lg font-black text-app-text">Choose a new password</h1>
          <p className="animate-rise mt-1.5 max-w-[17rem] text-[13px] leading-6 text-app-muted">
            Setting a new password for{" "}
            <span className="break-all font-black text-app-text">{email}</span>
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} noValidate className="animate-rise mt-6 grid gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="reset-password" className="text-[13px] font-black text-app-text">
              New password
            </label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 10 characters"
              disabled={saving}
              aria-describedby={passwordMessage ? "reset-password-hint" : undefined}
            />
            {passwordMessage ? (
              <p id="reset-password-hint" className="text-[12px] leading-5 text-app-muted">
                {passwordMessage}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="reset-confirm" className="text-[13px] font-black text-app-text">
              Confirm password
            </label>
            <PasswordInput
              id="reset-confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={saving}
            />
            {mismatch ? (
              <p className="text-[12px] text-red-600 dark:text-red-400">Passwords do not match.</p>
            ) : null}
          </div>

          {error ? (
            <p role="alert" aria-live="polite" className={ALERT_ERROR}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving || !passwordValid || mismatch || confirm.length === 0 || !ticket}
            aria-busy={saving}
            className={PRIMARY}
          >
            {saving ? (
              <>
                <MiniSpinner />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-5 text-app-muted">
          Your reset session expires {TICKET_TTL_MINUTES} minutes after the code was verified.
        </p>
      </>
    );
  }

  if (step === "code") {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="animate-pop otp-badge">
            <MailCheck size={22} strokeWidth={2.5} />
          </span>
          <h1 className="animate-rise mt-3 text-lg font-black text-app-text">Enter the code</h1>
          <p className="animate-rise mt-1.5 max-w-[17rem] text-[13px] leading-6 text-app-muted">
            We sent a {OTP_LENGTH}-digit code to{" "}
            <span className="break-all font-black text-app-text">{email}</span>
          </p>
          <button
            type="button"
            onClick={startOver}
            disabled={verifying}
            className="focus-ring mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-black text-app-muted underline underline-offset-4 transition hover:text-app-text disabled:opacity-60"
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            Use a different email
          </button>
        </div>

        <form onSubmit={handleVerifyCode} noValidate className="mt-5 grid gap-4">
          <div className={shaking ? "animate-shake" : undefined} onAnimationEnd={() => setShaking(false)}>
            <OtpCodeInput
              value={code}
              onChange={(next) => {
                setCode(next);
                setCodeInvalid(false);
                if (error) setError("");
              }}
              disabled={verifying}
              invalid={codeInvalid}
              autoFocus
              describedBy={error ? "reset-code-error" : undefined}
            />
          </div>

          {error ? (
            <p id="reset-code-error" role="alert" aria-live="polite" className={ALERT_ERROR}>
              {error}
            </p>
          ) : null}
          {info ? (
            <p role="status" aria-live="polite" className={ALERT_INFO}>
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={verifying || code.length !== OTP_LENGTH}
            aria-busy={verifying}
            className={PRIMARY}
          >
            {verifying ? (
              <>
                <MiniSpinner />
                Verifying…
              </>
            ) : (
              "Verify code"
            )}
          </button>

          <div className="flex items-center justify-center gap-1 text-[12px] text-app-muted">
            <span>{cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it?"}</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={!canResend}
              aria-busy={sending}
              className="focus-ring inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-black text-app-text underline underline-offset-4 transition disabled:text-app-muted disabled:no-underline disabled:opacity-70"
            >
              {sending ? <MiniSpinner className="size-3" /> : <RefreshCw size={12} strokeWidth={2.5} />}
              {sending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-[11px] leading-5 text-app-muted">
          Back to{" "}
          <Link href="/sign-in" className="focus-ring font-black underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <span aria-hidden="true" className="animate-pop otp-badge">
          <KeyRound size={22} strokeWidth={2.5} />
        </span>
        <h1 className="animate-rise mt-3 text-lg font-black text-app-text">Forgot your password?</h1>
        <p className="animate-rise mt-1.5 max-w-[17rem] text-[13px] leading-6 text-app-muted">
          Enter the email address on your account and we will send a 6-digit code.
        </p>
      </div>

      <form onSubmit={handleEmailSubmit} noValidate className="animate-rise mt-6 grid gap-3">
        <label htmlFor="reset-email" className="sr-only">
          Email address
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="send"
          required
          value={emailDraft}
          onChange={(event) => {
            setEmailDraft(event.target.value);
            if (verifyEmail) setVerifyEmail("");
          }}
          placeholder="you@example.com"
          disabled={sending}
          className="focus-ring min-h-[52px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 text-center text-sm font-bold text-app-text placeholder:font-normal placeholder:text-app-muted disabled:opacity-70"
        />

        {notice ? (
          <p role="status" aria-live="polite" className={ALERT_INFO}>
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" aria-live="polite" className={ALERT_ERROR}>
            {error}
          </p>
        ) : null}

        {verifyEmail ? (
          <Link
            href={`/verify-email?email=${encodeURIComponent(verifyEmail)}`}
            className="focus-ring inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-app-border bg-app-surface-2 text-[13px] font-black text-app-text transition active:scale-[0.98]"
          >
            Verify my email first
          </Link>
        ) : null}

        <button type="submit" disabled={sending || !emailDraft.trim()} aria-busy={sending} className={PRIMARY}>
          {sending ? (
            <>
              <MiniSpinner />
              Sending code…
            </>
          ) : (
            "Send code"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[12px] text-app-muted">
        Remembered it?{" "}
        <Link href="/sign-in" className="focus-ring font-black text-app-text underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
