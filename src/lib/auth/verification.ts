import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import "server-only";

import { AuthError } from "./auth-errors";

/**
 * Email verification challenge service.
 *
 * 6-digit codes, SHA-256 hashed at rest, single-use, short-lived.
 * Storage is injected so tests use memory and production can use persistent challenge storage.
 */

export const VERIFY_CODE_TTL_MS = 15 * 60_000;
export const VERIFY_CODE_MAX_ATTEMPTS = 5;
export const VERIFY_RESEND_COOLDOWN_MS = 60_000;

export type VerificationChallenge = {
  id: string;
  userId: number;
  purpose: "signup" | "claim" | "reset";
  codeHash: string;
  expiresAt: number;
  usedAt: number | null;
  attempts: number;
  createdAt: number;
  lastSentAt: number;
};

export type ChallengeStore = {
  latestForUser(userId: number, purpose: VerificationChallenge["purpose"]): Promise<VerificationChallenge | null>;
  save(challenge: VerificationChallenge): Promise<void>;
  markUsed(id: string, usedAt: number): Promise<void>;
  incrementAttempts(id: string, attempts: number): Promise<void>;
  deleteExpired(now: number): Promise<number>;
};

export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashVerificationCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function codesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function makeId(): string {
  return `${Date.now().toString(36)}-${randomInt(0, 1_000_000_000).toString(36)}`;
}

export async function issueChallenge(
  store: ChallengeStore,
  input: { userId: number; purpose: VerificationChallenge["purpose"]; now?: number },
): Promise<{ challenge: VerificationChallenge; code: string }> {
  const now = input.now ?? Date.now();
  const existing = await store.latestForUser(input.userId, input.purpose);
  if (existing && !existing.usedAt && existing.expiresAt > now) {
    if (now - existing.lastSentAt < VERIFY_RESEND_COOLDOWN_MS) {
      throw new AuthError("code-resend-cooldown", 429, "A code was sent recently. Please wait before requesting another.");
    }
  }
  const code = generateVerificationCode();
  const challenge: VerificationChallenge = {
    id: makeId(),
    userId: input.userId,
    purpose: input.purpose,
    codeHash: hashVerificationCode(code),
    expiresAt: now + VERIFY_CODE_TTL_MS,
    usedAt: null,
    attempts: 0,
    createdAt: now,
    lastSentAt: now,
  };
  await store.save(challenge);
  return { challenge, code };
}

export async function consumeChallenge(
  store: ChallengeStore,
  input: { userId: number; purpose: VerificationChallenge["purpose"]; code: string; now?: number },
): Promise<VerificationChallenge> {
  const now = input.now ?? Date.now();
  const challenge = await store.latestForUser(input.userId, input.purpose);
  if (!challenge) {
    throw new AuthError("code-invalid", 400, "Invalid or expired verification code.");
  }
  if (challenge.usedAt !== null) {
    throw new AuthError("code-used", 400, "This verification code has already been used.");
  }
  if (challenge.expiresAt <= now) {
    throw new AuthError("code-expired", 400, "Invalid or expired verification code.");
  }
  if (challenge.attempts >= VERIFY_CODE_MAX_ATTEMPTS) {
    throw new AuthError("code-attempts-exceeded", 429, "Too many incorrect attempts. Request a new code.");
  }
  const ok = codesEqual(hashVerificationCode(input.code.trim()), challenge.codeHash);
  if (!ok) {
    await store.incrementAttempts(challenge.id, challenge.attempts + 1);
    const exhausted = challenge.attempts + 1 >= VERIFY_CODE_MAX_ATTEMPTS;
    throw new AuthError(
      exhausted ? "code-attempts-exceeded" : "code-invalid",
      exhausted ? 429 : 400,
      "Invalid or expired verification code.",
    );
  }
  await store.markUsed(challenge.id, now);
  return { ...challenge, usedAt: now };
}

/** Small in-memory store for tests and local dev wiring. */
export class MemoryChallengeStore implements ChallengeStore {
  private rows = new Map<string, VerificationChallenge>();

  async latestForUser(userId: number, purpose: VerificationChallenge["purpose"]) {
    let latest: VerificationChallenge | null = null;
    for (const row of this.rows.values()) {
      if (row.userId !== userId || row.purpose !== purpose) continue;
      if (!latest || row.createdAt > latest.createdAt) latest = row;
    }
    return latest;
  }

  async save(challenge: VerificationChallenge) {
    this.rows.set(challenge.id, { ...challenge });
  }

  async markUsed(id: string, usedAt: number) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, usedAt });
  }

  async incrementAttempts(id: string, attempts: number) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, attempts });
  }

  async deleteExpired(now: number) {
    let removed = 0;
    for (const [id, row] of this.rows) {
      if (row.expiresAt <= now && row.usedAt === null) {
        this.rows.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  get size() {
    return this.rows.size;
  }
}
