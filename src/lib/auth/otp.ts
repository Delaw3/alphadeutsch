import { createHmac, timingSafeEqual } from "node:crypto";

import "server-only";

import { AuthError } from "./auth-errors";

/**
 * OTP hashing helpers (Phase 2B).
 *
 * Only HMAC-SHA256 hexadecimal digests are stored. The plaintext OTP and the
 * pepper are never returned from this module for logging and are never written
 * to the database.
 */

export const OTP_PEPPER_ENV = "AUTH_CODE_PEPPER";
export const OTP_PEPPER_LENGTH = 64;
export const OTP_CODE_LENGTH = 6;

const OTP_PATTERN = /^\d{6}$/;
const PEPPER_PATTERN = /^[0-9a-fA-F]{64}$/;

/** Missing or weak pepper: fail closed without revealing configuration data. */
export class OtpConfigError extends AuthError {
  constructor() {
    super("store-error", 500, "Account service is unavailable.");
    this.name = "OtpConfigError";
  }
}

/** Invalid submitted code: keep the existing generic verification response. */
export class OtpFormatError extends AuthError {
  constructor() {
    super("code-invalid", 400, "Invalid or expired verification code.");
    this.name = "OtpFormatError";
  }
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Reads and validates the server-only HMAC pepper. */
export function readCodePepper(env: NodeJS.ProcessEnv = process.env): string {
  const pepper = env[OTP_PEPPER_ENV];
  if (
    typeof pepper !== "string" ||
    !PEPPER_PATTERN.test(pepper) ||
    hasControlCharacters(pepper)
  ) {
    throw new OtpConfigError();
  }
  return pepper;
}

/** True only for exactly six ASCII digits (after trimming surrounding space). */
export function isValidOtp(value: unknown): value is string {
  return typeof value === "string" && OTP_PATTERN.test(value.trim());
}

/** Normalizes and validates an OTP, throwing a generic code-invalid error. */
export function assertValidOtp(value: unknown): string {
  if (!isValidOtp(value)) throw new OtpFormatError();
  return value.trim();
}

/** HMAC-SHA256(pepper, OTP) as a 64-character lowercase hexadecimal digest. */
export function hashOtp(code: string, env: NodeJS.ProcessEnv = process.env): string {
  const normalized = assertValidOtp(code);
  const pepper = readCodePepper(env);
  return createHmac("sha256", pepper).update(normalized, "utf8").digest("hex");
}

/** Constant-time comparison for two hexadecimal digests. */
export function digestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(typeof a === "string" ? a : "", "utf8");
  const right = Buffer.from(typeof b === "string" ? b : "", "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies an OTP against a stored digest.
 * Invalid OTP formats return false; a missing pepper still fails closed.
 */
export function verifyOtpHash(
  code: string,
  digest: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    return digestsEqual(hashOtp(code, env), digest);
  } catch (error) {
    if (error instanceof OtpFormatError) return false;
    throw error;
  }
}
