import "server-only";

import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { AuthError } from "./auth-errors";
import { digestsEqual } from "./otp";
import type {
  ChallengePurpose,
  ChallengeStore,
  ConsumeAndVerifyInput,
  ConsumeChallengeInput,
  ConsumeChallengeResult,
  IssueChallengeInput,
  IssueChallengeResult,
  VerificationChallenge,
} from "./verification";
import { CHALLENGE_CLEANUP_BATCH_SIZE } from "./verification";

/**
 * Phase 2B — MySQL-backed verification challenge repository.
 *
 * All OTP values are stored only as HMAC-SHA256 hexadecimal digests. Issue and
 * consume operations use transactions and a `users` row lock so concurrent
 * serverless instances cannot bypass the resend cooldown or consume the same
 * challenge twice.
 *
 * Parameterized queries only; codes, digests and the pepper are never logged.
 */

type ChallengeRow = RowDataPacket & {
  id: number | string;
  user_id: number;
  purpose: string;
  code_hash: string;
  expires_at: Date | string;
  used_at: Date | string | null;
  attempts: number;
  created_at: Date | string;
  last_sent_at: Date | string;
};

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
};

type UserRow = RowDataPacket & {
  id: number;
  email_verified_at: Date | string | null;
};

const SELECT_COLS =
  "id, user_id, purpose, code_hash, expires_at, used_at, attempts, created_at, last_sent_at";

const INSERT_SQL =
  "INSERT INTO verification_challenges " +
  "(user_id, purpose, code_hash, expires_at, used_at, attempts, created_at, last_sent_at) " +
  "VALUES (?, ?, ?, FROM_UNIXTIME(?), IF(? IS NULL, NULL, FROM_UNIXTIME(?)), ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))";

function toMillis(value: Date | string | null): number | null {
  if (value === null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function toRequiredMillis(value: Date | string): number {
  return toMillis(value) ?? 0;
}

function toSeconds(value: number): number {
  return Math.floor(value / 1000);
}

function mapRow(row: ChallengeRow): VerificationChallenge {
  return {
    id: String(row.id),
    userId: row.user_id,
    purpose: row.purpose as ChallengePurpose,
    codeHash: row.code_hash,
    expiresAt: toRequiredMillis(row.expires_at),
    usedAt: toMillis(row.used_at),
    attempts: row.attempts,
    createdAt: toRequiredMillis(row.created_at),
    lastSentAt: toRequiredMillis(row.last_sent_at),
  };
}

function toStoreError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  return new AuthError("store-error", 500, "Account service is unavailable.");
}

function affectedRows(result: unknown): number {
  return (result as { affectedRows?: number }).affectedRows ?? 0;
}

export class MySqlChallengeStore implements ChallengeStore {
  constructor(private readonly pool: Pool) {}

  async latestForUser(
    userId: number,
    purpose: ChallengePurpose,
  ): Promise<VerificationChallenge | null> {
    try {
      const [rows] = await this.pool.query(
        `SELECT ${SELECT_COLS} FROM verification_challenges ` +
          "WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [userId, purpose],
      );
      const row = (rows as ChallengeRow[])[0];
      return row ? mapRow(row) : null;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async markUsed(id: string, usedAt: number): Promise<boolean> {
    try {
      const [result] = await this.pool.query(
        "UPDATE verification_challenges SET used_at = FROM_UNIXTIME(?) WHERE id = ? AND used_at IS NULL",
        [toSeconds(usedAt), id],
      );
      return affectedRows(result) > 0;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async incrementAttempts(id: string, maxAttempts: number): Promise<number> {
    try {
      await this.pool.query(
        "UPDATE verification_challenges SET attempts = attempts + 1 WHERE id = ? AND attempts < ?",
        [id, maxAttempts],
      );
      const [rows] = await this.pool.query(
        "SELECT attempts FROM verification_challenges WHERE id = ? LIMIT 1",
        [id],
      );
      return (rows as (RowDataPacket & { attempts: number })[])[0]?.attempts ?? 0;
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async supersedeActive(
    userId: number,
    purpose: ChallengePurpose,
    at: number,
  ): Promise<number> {
    try {
      const [result] = await this.pool.query(
        "UPDATE verification_challenges SET used_at = FROM_UNIXTIME(?) " +
          "WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
        [toSeconds(at), userId, purpose],
      );
      return affectedRows(result);
    } catch (error) {
      throw toStoreError(error);
    }
  }

  async deleteExpired(
    now: number,
    limit = CHALLENGE_CLEANUP_BATCH_SIZE,
  ): Promise<number> {
    const batch = Math.min(
      Math.max(0, Math.floor(limit)),
      CHALLENGE_CLEANUP_BATCH_SIZE,
    );
    if (batch === 0) return 0;
    try {
      const [result] = await this.pool.query(
        `DELETE FROM verification_challenges WHERE expires_at <= FROM_UNIXTIME(?) LIMIT ${batch}`,
        [toSeconds(now)],
      );
      return affectedRows(result);
    } catch (error) {
      throw toStoreError(error);
    }
  }


  async issue(input: IssueChallengeInput): Promise<IssueChallengeResult> {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();
      const userVerified = await this.lockUser(connection, input.challenge.userId);

      if (input.challenge.purpose === "signup" && userVerified) {
        await connection.commit();
        return { status: "already-verified" };
      }

      const latest = await this.selectLatest(
        connection,
        input.challenge.userId,
        input.challenge.purpose,
        true,
      );

      if (
        latest &&
        latest.usedAt === null &&
        latest.expiresAt > input.now &&
        input.now - latest.lastSentAt < input.cooldownMs
      ) {
        await connection.commit();
        return { status: "cooldown", challenge: latest };
      }

      await connection.query(
        "UPDATE verification_challenges SET used_at = FROM_UNIXTIME(?) " +
          "WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
        [toSeconds(input.now), input.challenge.userId, input.challenge.purpose],
      );
      const id = await this.insert(connection, input.challenge);

      await connection.commit();
      return { status: "created", challenge: { ...input.challenge, id } };
    } catch (error) {
      if (connection) await this.rollbackQuietly(connection);
      throw toStoreError(error);
    } finally {
      if (connection) connection.release();
    }
  }


  async consume(input: ConsumeChallengeInput): Promise<ConsumeChallengeResult> {
    return this.consumeInternal(input, false);
  }

  async consumeAndVerify(input: ConsumeAndVerifyInput): Promise<ConsumeChallengeResult> {
    return this.consumeInternal(input, true);
  }

  private async consumeInternal(
    input: ConsumeChallengeInput,
    markUserVerified: boolean,
  ): Promise<ConsumeChallengeResult> {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();
      await this.lockUser(connection, input.userId);

      const challenge = await this.selectLatest(
        connection,
        input.userId,
        input.purpose,
        true,
      );

      if (!challenge) {
        await connection.commit();
        return { status: "missing" };
      }
      if (challenge.usedAt !== null) {
        await connection.commit();
        return { status: "used", challenge };
      }
      if (challenge.expiresAt <= input.now) {
        await connection.commit();
        return { status: "expired", challenge };
      }
      if (challenge.attempts >= input.maxAttempts) {
        await connection.commit();
        return { status: "attempts-exceeded", challenge };
      }

      const matches =
        input.codeHash !== null && digestsEqual(challenge.codeHash, input.codeHash);
      if (!matches) {
        const attempts = Math.min(challenge.attempts + 1, input.maxAttempts);
        await connection.query(
          "UPDATE verification_challenges SET attempts = attempts + 1 WHERE id = ? AND attempts < ?",
          [challenge.id, input.maxAttempts],
        );
        await connection.commit();
        return {
          status: attempts >= input.maxAttempts ? "attempts-exceeded" : "invalid",
          challenge: { ...challenge, attempts },
          attempts,
          exhausted: attempts >= input.maxAttempts,
        };
      }

      const [result] = await connection.query(
        "UPDATE verification_challenges SET used_at = FROM_UNIXTIME(?) " +
          "WHERE id = ? AND used_at IS NULL",
        [toSeconds(input.now), challenge.id],
      );

      if (affectedRows(result) !== 1) {
        await connection.rollback();
        return { status: "used", challenge };
      }

      if (markUserVerified) {
        // Same transaction: a failure here rolls back the challenge update too.
        await connection.query(
          "UPDATE users SET email_verified_at = FROM_UNIXTIME(?) WHERE id = ?",
          [toSeconds(input.now), input.userId],
        );
      }

      await connection.commit();
      return { status: "consumed", challenge: { ...challenge, usedAt: input.now } };
    } catch (error) {
      if (connection) await this.rollbackQuietly(connection);
      throw toStoreError(error);
    } finally {
      if (connection) connection.release();
    }
  }


  /** Locks the user and returns whether the account is already verified. */
  private async lockUser(connection: PoolConnection, userId: number): Promise<boolean> {
    const [rows] = await connection.query(
      "SELECT id, email_verified_at FROM users WHERE id = ? FOR UPDATE",
      [userId],
    );
    const user = (rows as UserRow[])[0];
    if (!user) {
      throw new AuthError("store-error", 500, "Account service is unavailable.");
    }
    return user.email_verified_at !== null;
  }

  private async selectLatest(
    queryable: Queryable,
    userId: number,
    purpose: ChallengePurpose,
    forUpdate: boolean,
  ): Promise<VerificationChallenge | null> {
    const [rows] = await queryable.query(
      `SELECT ${SELECT_COLS} FROM verification_challenges ` +
        "WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC, id DESC LIMIT 1" +
        (forUpdate ? " FOR UPDATE" : ""),
      [userId, purpose],
    );
    const row = (rows as ChallengeRow[])[0];
    return row ? mapRow(row) : null;
  }

  private async insert(queryable: Queryable, challenge: VerificationChallenge): Promise<string> {
    const usedAt = challenge.usedAt === null ? null : toSeconds(challenge.usedAt);
    const [result] = await queryable.query(INSERT_SQL, [
      challenge.userId,
      challenge.purpose,
      challenge.codeHash,
      toSeconds(challenge.expiresAt),
      usedAt,
      usedAt,
      challenge.attempts,
      toSeconds(challenge.createdAt),
      toSeconds(challenge.lastSentAt),
    ]);
    const insertId = (result as ResultSetHeader).insertId;
    if (!insertId) throw new AuthError("store-error", 500, "Account service is unavailable.");
    return String(insertId);
  }

  private async rollbackQuietly(connection: PoolConnection): Promise<void> {
    try {
      await connection.rollback();
    } catch {
      // Preserve the original error; rollback failure must not leak details.
    }
  }
}
