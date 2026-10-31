import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { AuthError } from "./auth-errors";
import type { AppUser, UserStore } from "./auth-service";

/**
 * Phase C1 — MySQL-backed user repository.
 *
 * Coded against the migrated `users` schema:
 *   password_hash VARCHAR(255) NULL COMMENT 'bcrypt hash; NULL when unset, verifyPassword rejects empty hashes',
 *   email_verified_at DATETIME NULL,
 *   failed_logins INT NOT NULL DEFAULT 0,
 *   locked_until DATETIME NULL,
 *   stud2022_id INT NULL UNIQUE
 *
 * Column note:
 *   `password_hash` is NULL for uncredentialed accounts; verifyPassword explicitly
 *   rejects empty string, whitespace, or NULL hashes.
 *
 * All queries are parameterized. No credentials, hashes, or PII are logged.
 */

export type AuthPool = {
  query: (sql: string, params?: unknown[]) => Promise<[RowDataPacket[], unknown]>;
};

type UserRow = RowDataPacket & {
  id: number;
  email: string;
  name: string | null;
  role: string;
  /** bcrypt hash; NULL when unset, verifyPassword rejects empty hashes */
  password_hash: string | null;
  email_verified_at: Date | string | null;
  failed_logins?: number;
  locked_until?: Date | string | null;
  stud2022_id: number | null;
  created_at: Date | string;
};

function toMillis(value: Date | string | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function mapRow(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash ?? "",
    emailVerifiedAt: toMillis(row.email_verified_at),
    failedLogins: row.failed_logins ?? 0,
    lockedUntil: toMillis(row.locked_until ?? null),
    stud2022Id: row.stud2022_id ?? null,
    createdAt: toMillis(row.created_at) ?? Date.now(),
  };
}

const SELECT_USER_FIELDS =
  "id, email, name, role, password_hash, email_verified_at, failed_logins, locked_until, stud2022_id, created_at";

function toStoreError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  return new AuthError("store-error", 500, "Account service is unavailable.");
}

export class MySqlUserStore implements UserStore {
  constructor(private readonly pool: AuthPool) {}

  async findByEmail(email: string): Promise<AppUser | null> {
    try {
      const [rows] = await this.pool.query(
        `SELECT ${SELECT_USER_FIELDS} FROM users WHERE email = ? LIMIT 1`,
        [email],
      );
      const row = (rows as UserRow[])[0];
      return row ? mapRow(row) : null;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async findById(id: number): Promise<AppUser | null> {
    try {
      const [rows] = await this.pool.query(
        `SELECT ${SELECT_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
        [id],
      );
      const row = (rows as UserRow[])[0];
      return row ? mapRow(row) : null;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async findByStud2022Id(stud2022Id: number): Promise<AppUser | null> {
    try {
      const [rows] = await this.pool.query(
        `SELECT ${SELECT_USER_FIELDS} FROM users WHERE stud2022_id = ? LIMIT 1`,
        [stud2022Id],
      );
      const row = (rows as UserRow[])[0];
      return row ? mapRow(row) : null;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async create(input: {
    email: string;
    name: string | null;
    passwordHash: string;
    stud2022Id?: number | null;
  }): Promise<AppUser> {
    try {
      const [result] = await this.pool.query(
        "INSERT INTO users (email, name, role, password_hash, stud2022_id) VALUES (?, ?, 'user', ?, ?)",
        [input.email, input.name, input.passwordHash, input.stud2022Id ?? null],
      );
      const insertId = (result as { insertId?: number }).insertId;
      if (!insertId) throw new AuthError("store-error", 500, "Account service is unavailable.");
      const created = await this.findById(insertId);
      if (!created) throw new AuthError("store-error", 500, "Account service is unavailable.");
      return created;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      const code = (error as { code?: string }).code;
      // Duplicate email or stud2022_id under race: stay generic, never reveal existence.
      if (code === "ER_DUP_ENTRY") {
        const existing = await this.findByEmail(input.email).catch(() => null);
        if (existing) {
          throw new AuthError("store-error", 500, "Account service is unavailable.");
        }
      }
      throw toStoreError(error);
    }
  }

  async markEmailVerified(id: number, at: number): Promise<void> {
    try {
      await this.pool.query("UPDATE users SET email_verified_at = FROM_UNIXTIME(?) WHERE id = ?", [
        Math.floor(at / 1000),
        id,
      ]);
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async recordFailedLogin(id: number, failedLogins: number, lockedUntil: number | null): Promise<void> {
    try {
      const lockedSec = lockedUntil ? Math.floor(lockedUntil / 1000) : null;
      await this.pool.query(
        "UPDATE users SET failed_logins = ?, locked_until = IF(? IS NULL, NULL, FROM_UNIXTIME(?)) WHERE id = ?",
        [failedLogins, lockedSec, lockedSec, id],
      );
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async resetFailedLogins(id: number): Promise<void> {
    try {
      await this.pool.query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?", [id]);
    } catch (error) {
      throw toStoreError(error);
    }
  }
}
