/**
 * Phase B auth foundation — server-only helpers.
 *
 * Pure, dependency-light building blocks for the auth foundation.
 * Injectable stores and clocks keep unit tests isolated (no DB, no network).
 */

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRequirementMessage,
} from "./password-rules";

export const GENERIC_AUTH_ERROR = "Invalid email or password.";

export type AuthErrorCode =
  | "invalid-input"
  | "invalid-credentials"
  | "rate-limited"
  | "email-not-verified"
  | "account-locked"
  | "unauthorized"
  | "code-invalid"
  | "code-expired"
  | "code-used"
  | "code-attempts-exceeded"
  | "code-resend-cooldown"
  | "reset-token-invalid"
  | "account-not-found"
  | "provider-error"
  | "store-error";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode, status: number, message = "Authentication failed.") {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

/** Generic login failure — identical message for unknown email vs bad password. */
export function invalidCredentials(): AuthError {
  return new AuthError("invalid-credentials", 401, GENERIC_AUTH_ERROR);
}

export function unauthorized(message = "Sign in required."): AuthError {
  return new AuthError("unauthorized", 401, message);
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 320 || !EMAIL_RE.test(email)) return null;
  return email;
}

export type PasswordCheck = { ok: boolean; reason?: string };

/**
 * Minimum 10 chars with upper, lower, digit, symbol. Server-enforced.
 * Rule definitions live in `password-rules.ts` so the auth forms show the
 * same, exact "what is missing" text as this server response.
 */
export function validateNewPassword(password: unknown): PasswordCheck {
  if (typeof password !== "string") return { ok: false, reason: "Password is required." };
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, reason: `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.` };
  }
  const reason = passwordRequirementMessage(password);
  if (reason) return { ok: false, reason };
  return { ok: true };
}

export function validateDisplayName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 120) return null;
  return trimmed;
}

/**
 * Normalises date of birth to YYYY-MM-DD.
 * Supports Date instances, YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY.
 */
export function normalizeDob(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])$/.exec(trimmed);
  if (ymd) {
    const y = parseInt(ymd[1]!, 10);
    const m = parseInt(ymd[2]!, 10);
    const d = parseInt(ymd[3]!, 10);
    if (y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = /^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{4})$/.exec(trimmed);
  if (dmy) {
    const d = parseInt(dmy[1]!, 10);
    const m = parseInt(dmy[2]!, 10);
    const y = parseInt(dmy[3]!, 10);
    if (y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  return null;
}

/** Generic signup response — never reveals whether the email already exists. */
export const GENERIC_SIGNUP_MESSAGE =
  "If this email can receive verification, a code has been issued.";
