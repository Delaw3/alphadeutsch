import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { AuthError } from "./auth-errors";
import type { SessionRecord, SessionStore } from "./sessions";

/**
 * Phase C1 — MySQL-backed session repository (NOT yet wired to routes).
 *
 * The live `sessions` table already fits: token_hash char(64) UNIQUE,
 * expires_at indexed, user FK, request_ip/user_agent nullable. Implemented +
 * mock-tested here; route wiring happens only after review (C2).
 * Parameterized queries only; tokens/hashes never logged.
 */

export type AuthPool = {
  query: (sql: string, params?: unknown[]) => Promise<[RowDataPacket[], unknown]>;
  getConnection?: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<[RowDataPacket[], unknown]>;
    release: () => void;
  }>;
};

type SessionRow = RowDataPacket & {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date | string;
  created_at: Date | string;
  last_seen_at: Date | string;
  request_ip: string | null;
  user_agent: string | null;
};

function toMillis(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : Date.now();
}

function mapRow(row: SessionRow): SessionRecord {
  return {
    id: String(row.id),
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: toMillis(row.expires_at),
    createdAt: toMillis(row.created_at),
    lastSeenAt: toMillis(row.last_seen_at),
    requestIp: row.request_ip,
    userAgent: row.user_agent,
  };
}

const SELECT_COLS =
  "id, user_id, token_hash, expires_at, created_at, last_seen_at, request_ip, user_agent";

function toStoreError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  return new AuthError("store-error", 500, "Account service is unavailable.");
}

export class MySqlSessionStore implements SessionStore {
  constructor(private readonly pool: AuthPool) {}

  async create(record: SessionRecord): Promise<void> {
    try {
      await this.pool.query(
        "INSERT INTO sessions (user_id, token_hash, expires_at, request_ip, user_agent) VALUES (?, ?, FROM_UNIXTIME(?), ?, ?)",
        [
          record.userId,
          record.tokenHash,
          Math.floor(record.expiresAt / 1000),
          record.requestIp,
          record.userAgent,
        ],
      );
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    try {
      const [rows] = await this.pool.query(
        `SELECT ${SELECT_COLS} FROM sessions WHERE token_hash = ? LIMIT 1`,
        [tokenHash],
      );
      const row = (rows as SessionRow[])[0];
      return row ? mapRow(row) : null;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async touch(id: string, lastSeenAt: number, expiresAt: number): Promise<void> {
    const numericId = Number(id);
    try {
      if (!Number.isInteger(numericId)) return;
      await this.pool.query(
        "UPDATE sessions SET last_seen_at = FROM_UNIXTIME(?), expires_at = FROM_UNIXTIME(?) WHERE id = ?",
        [Math.floor(lastSeenAt / 1000), Math.floor(expiresAt / 1000), numericId],
      );
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async revokeByTokenHash(tokenHash: string): Promise<boolean> {
    try {
      const [, result] = await this.pool.query("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
      return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async revokeAllForUser(userId: number): Promise<number> {
    try {
      const [, result] = await this.pool.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
      return (result as { affectedRows?: number }).affectedRows ?? 0;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async deleteExpired(now: number): Promise<number> {
    try {
      const [, result] = await this.pool.query("DELETE FROM sessions WHERE expires_at <= FROM_UNIXTIME(?)", [
        Math.floor(now / 1000),
      ]);
      return (result as { affectedRows?: number }).affectedRows ?? 0;
    } catch (error) {
      throw toStoreError(error);
    }
  }
}
