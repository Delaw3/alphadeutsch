// Whole-second clocks and challenge fixtures.
//
// The table uses DATETIME without fractional seconds and the store converts
// epochs with FROM_UNIXTIME(). Keeping every test timestamp on a whole second
// makes TTL/cooldown assertions exact instead of tolerance games.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../preload.cjs");

const { hashOtp } = require("../../build/auth/otp.js");
const {
  VERIFY_CODE_TTL_MS,
  VERIFY_CODE_MAX_ATTEMPTS,
  VERIFY_RESEND_COOLDOWN_MS,
  CHALLENGE_CLEANUP_BATCH_SIZE,
} = require("../../build/auth/verification.js");

export const TTL_MS = VERIFY_CODE_TTL_MS;
export const MAX_ATTEMPTS = VERIFY_CODE_MAX_ATTEMPTS;
export const COOLDOWN_MS = VERIFY_RESEND_COOLDOWN_MS;
export const CLEANUP_BATCH_SIZE = CHALLENGE_CLEANUP_BATCH_SIZE;

export const ONE_SECOND_MS = 1000;
export const ONE_MINUTE_MS = 60_000;

let sequence = 0;

/** Floors a timestamp to the precision the DATETIME columns can store. */
export function wholeSecond(value = Date.now()) {
  return Math.floor(value / ONE_SECOND_MS) * ONE_SECOND_MS;
}

export function codeHashFor(code) {
  return hashOtp(code);
}

/**
 * Builds the plain object MySqlChallengeStore.issue() expects. `now` defaults
 * to the current whole second; `expiresAt` can be overridden for expiry tests.
 */
export function buildChallenge({
  userId,
  purpose = "signup",
  code = "123456",
  now = wholeSecond(),
  ttlMs = TTL_MS,
  expiresAt,
  usedAt = null,
  attempts = 0,
  codeHash,
} = {}) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("buildChallenge requires a positive integer userId.");
  }
  sequence += 1;
  const createdAt = wholeSecond(now);
  return {
    id: `it-${createdAt}-${sequence}`,
    userId,
    purpose,
    codeHash: codeHash ?? hashOtp(code),
    expiresAt: expiresAt ?? createdAt + ttlMs,
    usedAt,
    attempts,
    createdAt,
    lastSentAt: createdAt,
  };
}

export function withinTolerance(actual, expected, toleranceMs = ONE_SECOND_MS) {
  return Math.abs(Number(actual) - Number(expected)) <= toleranceMs;
}
