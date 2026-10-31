import "server-only";

import bcrypt from "bcryptjs";

/**
 * bcrypt password hashing for app-created credentials only.
 * Cost 12 balances login latency (~150–300ms) with brute-force resistance.
 * Test code may pass a lower cost; production paths use the default.
 * Never used for legacy `stud2022.killer` values (algorithm unconfirmed).
 */
export const BCRYPT_COST = 12;

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export async function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  const salt = await bcrypt.genSalt(cost);
  return bcrypt.hash(password, salt);
}

/**
 * Verifies a plain text password against a stored hash.
 * Explicitly rejects empty, whitespace, null/undefined, or malformed password_hash values.
 * Returns false instead of throwing (timing-safe path).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (typeof password !== "string" || typeof hash !== "string" || hash.trim().length === 0) return false;
  if (!BCRYPT_RE.test(hash)) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function isBcryptHash(value: unknown): boolean {
  return typeof value === "string" && BCRYPT_RE.test(value);
}

/** Dummy compare to keep unknown-email timing close to known-email timing. */
export async function dummyPasswordCompare(): Promise<void> {
  await bcrypt.compare(
    "timing-dummy-password",
    "$2b$12$R9h/cIUHhXr8k8r8Z8Z8Zu2K5K5K5K5K5K5K5K5K5K5K5K5K5K5K",
  );
}
