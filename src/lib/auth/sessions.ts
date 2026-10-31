import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import "server-only";

import { unauthorized } from "./auth-errors";

/**
 * Session token service (Phase B local foundation).
 *
 * 256-bit opaque tokens; only the SHA-256 hash is stored — the shape matches
 * the existing `sessions` table (token_hash char(64), expires_at, user FK).
 * Storage is injected: tests use memory, production wiring uses MySQL.
 */

export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
export const SESSION_COOKIE_NAME = "alphadeutsch_session";

export type SessionRecord = {
  id: string;
  userId: number;
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
  lastSeenAt: number;
  requestIp: string | null;
  userAgent: string | null;
};

export type SessionStore = {
  create(record: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touch(id: string, lastSeenAt: number, expiresAt: number): Promise<void>;
  revokeByTokenHash(tokenHash: string): Promise<boolean>;
  revokeAllForUser(userId: number): Promise<number>;
  deleteExpired(now: number): Promise<number>;
};

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function createSession(
  store: SessionStore,
  input: { userId: number; requestIp?: string | null; userAgent?: string | null; now?: number },
): Promise<{ record: SessionRecord; token: string }> {
  const now = input.now ?? Date.now();
  const token = generateSessionToken();
  const record: SessionRecord = {
    id: `sess-${now.toString(36)}-${randomBytes(4).toString("hex")}`,
    userId: input.userId,
    tokenHash: hashSessionToken(token),
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
    lastSeenAt: now,
    requestIp: input.requestIp ?? null,
    userAgent: (input.userAgent ?? null)?.slice(0, 255) ?? null,
  };
  await store.create(record);
  return { record, token };
}

export type ValidatedSession = { userId: number; record: SessionRecord };

/** Returns null for missing/expired/unknown tokens (callers map to 401). */
export async function validateSessionToken(
  store: SessionStore,
  token: string | null | undefined,
  now = Date.now(),
): Promise<ValidatedSession | null> {
  if (!token || typeof token !== "string" || token.length < 32) return null;
  const record = await store.findByTokenHash(hashSessionToken(token));
  if (!record) return null;
  if (!safeEqualHex(record.tokenHash, hashSessionToken(token))) return null;
  if (record.expiresAt <= now) return null;
  // Sliding refresh: extend expiry while active, persist sparingly is a later concern.
  return { userId: record.userId, record };
}

export async function revokeSession(store: SessionStore, token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    return await store.revokeByTokenHash(hashSessionToken(token));
  } catch {
    return false;
  }
}

/** Throws 401 when no valid session exists — use in protected routes/APIs. */
export async function requireSessionUser(
  store: SessionStore,
  token: string | null | undefined,
  now = Date.now(),
) {
  const valid = await validateSessionToken(store, token, now);
  if (!valid) throw unauthorized();
  return valid;
}

export function buildSessionCookie(token: string, opts?: { secure?: boolean; maxAgeSec?: number }): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const maxAge = opts?.maxAgeSec ?? Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionCookie(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = part.slice(idx + 1).trim();
      return value || null;
    }
  }
  return null;
}

/** In-memory store for tests and local dev wiring. */
export class MemorySessionStore implements SessionStore {
  private rows = new Map<string, SessionRecord>(); // keyed by tokenHash

  async create(record: SessionRecord) {
    this.rows.set(record.tokenHash, { ...record });
  }

  async findByTokenHash(tokenHash: string) {
    const row = this.rows.get(tokenHash);
    return row ? { ...row } : null;
  }

  async touch(id: string, lastSeenAt: number, expiresAt: number) {
    for (const [key, row] of this.rows) {
      if (row.id === id) {
        this.rows.set(key, { ...row, lastSeenAt, expiresAt });
        return;
      }
    }
  }

  async revokeByTokenHash(tokenHash: string) {
    return this.rows.delete(tokenHash);
  }

  async revokeAllForUser(userId: number) {
    let removed = 0;
    for (const [key, row] of this.rows) {
      if (row.userId === userId) {
        this.rows.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  async deleteExpired(now: number) {
    let removed = 0;
    for (const [key, row] of this.rows) {
      if (row.expiresAt <= now) {
        this.rows.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size() {
    return this.rows.size;
  }
}
