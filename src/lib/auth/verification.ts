import { randomInt } from "node:crypto";

import "server-only";

import { AuthError } from "./auth-errors";
import { digestsEqual, hashOtp, isValidOtp, readCodePepper } from "./otp";

/**
 * Email verification challenge service.
 *
 * Six-digit OTPs are stored only as HMAC-SHA256 digests. The store is
 * responsible for atomic issue/consume operations so verification remains
 * correct across concurrent serverless instances.
 */

export const VERIFY_CODE_TTL_MS = 10 * 60_000;
export const VERIFY_CODE_MAX_ATTEMPTS = 5;
export const VERIFY_RESEND_COOLDOWN_MS = 60_000;

export type ChallengePurpose = "signup" | "claim" | "reset";

export type VerificationChallenge = {
  id: string;
  userId: number;
  purpose: ChallengePurpose;
  codeHash: string;
  expiresAt: number;
  usedAt: number | null;
  attempts: number;
  createdAt: number;
  lastSentAt: number;
};

export type IssueChallengeInput = {
  challenge: VerificationChallenge;
  cooldownMs: number;
  now: number;
  /**
   * Memory stores use this callback to re-check the account state while the
   * per-user lock is held. MySQL performs the equivalent check inside its
   * transaction and ignores the callback.
   */
  isUserVerified?: () => Promise<boolean>;
};

export type IssueChallengeResult =
  | { status: "created"; challenge: VerificationChallenge }
  | { status: "cooldown"; challenge: VerificationChallenge }
  | { status: "already-verified" };

export type IssueChallengeOutcome =
  | { status: "issued"; challenge: VerificationChallenge; code: string }
  | { status: "already-verified" };

export type ConsumeChallengeInput = {
  userId: number;
  purpose: ChallengePurpose;
  /** null represents a malformed submission that still counts as an attempt. */
  codeHash: string | null;
  maxAttempts: number;
  now: number;
};

/**
 * Verification-specific consumption. The store must make challenge
 * consumption and the user's verified state one atomic operation:
 * - MySQL updates both rows in one transaction.
 * - Memory mode invokes `verifyUser` and restores the challenge if it fails.
 */
export type ConsumeAndVerifyInput = ConsumeChallengeInput & {
  verifyUser: () => Promise<void>;
};

export type ConsumeChallengeResult =
  | { status: "consumed"; challenge: VerificationChallenge }
  | { status: "missing" }
  | { status: "used"; challenge: VerificationChallenge }
  | { status: "expired"; challenge: VerificationChallenge }
  | { status: "attempts-exceeded"; challenge: VerificationChallenge }
  | { status: "invalid"; challenge: VerificationChallenge; attempts: number; exhausted: boolean };

export const CHALLENGE_CLEANUP_BATCH_SIZE = 100;

export type ChallengeStore = {
  latestForUser(userId: number, purpose: ChallengePurpose): Promise<VerificationChallenge | null>;
  markUsed(id: string, usedAt: number): Promise<boolean>;
  incrementAttempts(id: string, maxAttempts: number): Promise<number>;
  supersedeActive(userId: number, purpose: ChallengePurpose, at: number): Promise<number>;
  deleteExpired(now: number, limit?: number): Promise<number>;
  issue(input: IssueChallengeInput): Promise<IssueChallengeResult>;
  consume(input: ConsumeChallengeInput): Promise<ConsumeChallengeResult>;
  consumeAndVerify(input: ConsumeAndVerifyInput): Promise<ConsumeChallengeResult>;
};

export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function makeId(): string {
  return `${Date.now().toString(36)}-${randomInt(0, 1_000_000_000).toString(36)}`;
}

export async function issueChallenge(
  store: ChallengeStore,
  input: {
    userId: number;
    purpose: ChallengePurpose;
    now?: number;
    isUserVerified?: () => Promise<boolean>;
  },
): Promise<IssueChallengeOutcome> {
  const now = input.now ?? Date.now();
  const code = generateVerificationCode();
  const challenge: VerificationChallenge = {
    id: makeId(),
    userId: input.userId,
    purpose: input.purpose,
    codeHash: hashOtp(code),
    expiresAt: now + VERIFY_CODE_TTL_MS,
    usedAt: null,
    attempts: 0,
    createdAt: now,
    lastSentAt: now,
  };

  const result = await store.issue({
    challenge,
    cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
    now,
    isUserVerified: input.isUserVerified,
  });

  if (result.status === "cooldown") {
    throw new AuthError(
      "code-resend-cooldown",
      429,
      "A code was sent recently. Please wait before requesting another.",
    );
  }
  if (result.status === "already-verified") {
    return { status: "already-verified" };
  }

  // Bounded opportunistic cleanup must never make issuing a code fail.
  try {
    await store.deleteExpired(now, CHALLENGE_CLEANUP_BATCH_SIZE);
  } catch {
    // Cleanup is best-effort; the active challenge remains valid.
  }

  return { status: "issued", challenge: result.challenge, code };
}

export async function consumeChallenge(
  store: ChallengeStore,
  input: { userId: number; purpose: ChallengePurpose; code: string; now?: number },
  verifyUser?: () => Promise<void>,
): Promise<VerificationChallenge> {
  const now = input.now ?? Date.now();
  // Fail closed on a missing/weak pepper even for malformed submissions.
  // Malformed six-digit failures still reach the store and count as attempts.
  readCodePepper();
  const codeHash = isValidOtp(input.code) ? hashOtp(input.code) : null;
  const consumeInput = {
    userId: input.userId,
    purpose: input.purpose,
    codeHash,
    maxAttempts: VERIFY_CODE_MAX_ATTEMPTS,
    now,
  };
  if (verifyUser && typeof store.consumeAndVerify !== "function") {
    throw new AuthError("store-error", 500, "Account service is unavailable.");
  }
  const result = verifyUser
    ? await store.consumeAndVerify({ ...consumeInput, verifyUser })
    : await store.consume(consumeInput);

  switch (result.status) {
    case "consumed":
      return result.challenge;
    case "used":
      throw new AuthError("code-used", 400, "This verification code has already been used.");
    case "expired":
      throw new AuthError("code-expired", 400, "Invalid or expired verification code.");
    case "attempts-exceeded":
      throw new AuthError(
        "code-attempts-exceeded",
        429,
        "Too many incorrect attempts. Request a new code.",
      );
    case "invalid":
      throw new AuthError(
        result.exhausted ? "code-attempts-exceeded" : "code-invalid",
        result.exhausted ? 429 : 400,
        "Invalid or expired verification code.",
      );
    case "missing":
    default:
      throw new AuthError("code-invalid", 400, "Invalid or expired verification code.");
  }
}

/** Small in-memory store for tests and local dev wiring. */
export class MemoryChallengeStore implements ChallengeStore {
  private rows = new Map<string, VerificationChallenge>();
  private userLocks = new Map<number, Promise<void>>();

  private async withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
    const previous = this.userLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.userLocks.set(userId, current);
    try {
      await previous;
      return await fn();
    } finally {
      release();
      if (this.userLocks.get(userId) === current) this.userLocks.delete(userId);
    }
  }

  private findLatest(userId: number, purpose: ChallengePurpose): VerificationChallenge | null {
    let latest: VerificationChallenge | null = null;
    for (const row of this.rows.values()) {
      if (row.userId !== userId || row.purpose !== purpose) continue;
      if (
        !latest ||
        row.createdAt > latest.createdAt ||
        (row.createdAt === latest.createdAt && row.id > latest.id)
      ) {
        latest = row;
      }
    }
    return latest;
  }

  async latestForUser(userId: number, purpose: ChallengePurpose) {
    const latest = this.findLatest(userId, purpose);
    return latest ? { ...latest } : null;
  }

  /** Test-only seeding/mutation helper; production creation goes through issue(). */
  async saveForTest(challenge: VerificationChallenge) {
    const stored = { ...challenge };
    this.rows.set(stored.id, stored);
    return { ...stored };
  }

  async markUsed(id: string, usedAt: number) {
    const row = this.rows.get(id);
    if (!row || row.usedAt !== null) return false;
    this.rows.set(id, { ...row, usedAt });
    return true;
  }

  async incrementAttempts(id: string, maxAttempts: number) {
    const row = this.rows.get(id);
    if (!row) return 0;
    const attempts = Math.min(row.attempts + 1, Math.max(0, maxAttempts));
    this.rows.set(id, { ...row, attempts });
    return attempts;
  }

  async supersedeActive(userId: number, purpose: ChallengePurpose, at: number) {
    let superseded = 0;
    for (const [id, row] of this.rows) {
      if (row.userId !== userId || row.purpose !== purpose || row.usedAt !== null) continue;
      this.rows.set(id, { ...row, usedAt: at });
      superseded += 1;
    }
    return superseded;
  }

  async deleteExpired(now: number, limit = CHALLENGE_CLEANUP_BATCH_SIZE) {
    const max = Math.min(Math.max(0, Math.floor(limit)), CHALLENGE_CLEANUP_BATCH_SIZE);
    let removed = 0;
    for (const [id, row] of this.rows) {
      if (removed >= max) break;
      if (row.expiresAt <= now) {
        this.rows.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async issue(input: IssueChallengeInput): Promise<IssueChallengeResult> {
    return this.withUserLock(input.challenge.userId, () => this.issueUnlocked(input));
  }

  private async issueUnlocked(input: IssueChallengeInput): Promise<IssueChallengeResult> {
    if (
      input.challenge.purpose === "signup" &&
      input.isUserVerified &&
      (await input.isUserVerified())
    ) {
      return { status: "already-verified" };
    }

    const latest = this.findLatest(input.challenge.userId, input.challenge.purpose);
    if (
      latest &&
      latest.usedAt === null &&
      latest.expiresAt > input.now &&
      input.now - latest.lastSentAt < input.cooldownMs
    ) {
      return { status: "cooldown", challenge: { ...latest } };
    }

    this.supersedeActiveSync(input.challenge.userId, input.challenge.purpose, input.now);
    const stored = { ...input.challenge };
    this.rows.set(stored.id, stored);
    return { status: "created", challenge: { ...stored } };
  }

  async consume(input: ConsumeChallengeInput): Promise<ConsumeChallengeResult> {
    return this.withUserLock(input.userId, async () => this.consumeUnlocked(input));
  }

  private consumeUnlocked(input: ConsumeChallengeInput): ConsumeChallengeResult {
    const challenge = this.findLatest(input.userId, input.purpose);
    if (!challenge) return { status: "missing" };
    if (challenge.usedAt !== null) return { status: "used", challenge: { ...challenge } };
    if (challenge.expiresAt <= input.now) return { status: "expired", challenge: { ...challenge } };
    if (challenge.attempts >= input.maxAttempts) {
      return { status: "attempts-exceeded", challenge: { ...challenge } };
    }

    const matches = input.codeHash !== null && digestsEqual(challenge.codeHash, input.codeHash);
    if (!matches) {
      const attempts = Math.min(challenge.attempts + 1, input.maxAttempts);
      this.rows.set(challenge.id, { ...challenge, attempts });
      return {
        status: attempts >= input.maxAttempts ? "attempts-exceeded" : "invalid",
        challenge: { ...challenge, attempts },
        attempts,
        exhausted: attempts >= input.maxAttempts,
      };
    }

    if (!this.markUsedSync(challenge.id, input.now)) {
      return { status: "used", challenge: { ...challenge, usedAt: input.now } };
    }
    return { status: "consumed", challenge: { ...challenge, usedAt: input.now } };
  }

  async consumeAndVerify(input: ConsumeAndVerifyInput): Promise<ConsumeChallengeResult> {
    return this.withUserLock(input.userId, async () => {
      const result = this.consumeUnlocked(input);
      if (result.status !== "consumed") return result;

      try {
        await input.verifyUser();
        return result;
      } catch (error) {
        // Memory mode has no database transaction; restore the used marker so a
        // failed user update cannot consume the OTP permanently.
        const row = this.rows.get(result.challenge.id);
        if (row) this.rows.set(row.id, { ...row, usedAt: null });
        throw error;
      }
    });
  }

  private supersedeActiveSync(userId: number, purpose: ChallengePurpose, at: number): number {
    let superseded = 0;
    for (const [id, row] of this.rows) {
      if (row.userId !== userId || row.purpose !== purpose || row.usedAt !== null) continue;
      this.rows.set(id, { ...row, usedAt: at });
      superseded += 1;
    }
    return superseded;
  }

  private markUsedSync(id: string, usedAt: number): boolean {
    const row = this.rows.get(id);
    if (!row || row.usedAt !== null) return false;
    this.rows.set(id, { ...row, usedAt });
    return true;
  }

  get size() {
    return this.rows.size;
  }
}
