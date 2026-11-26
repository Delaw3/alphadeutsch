// Disposable, test-owned application users.
//
// Every integration test gets a unique `otp-it+<run id>-…@example.invalid`
// mailbox, where the run id is generated once per test process. Cleanup:
//   - re-reads the row and refuses to touch a user unless (id, email) still match;
//   - deletes only the exact ids it created (child rows are deleted first);
//   - reconciles anything created under this run's prefix but never tracked —
//     for example a user inserted by AuthService.signup before the mail provider
//     failed;
//   - verifies with COUNT(*) queries that nothing survived.
// No TRUNCATE and no global DELETE is ever issued from this module.

import { randomBytes } from "node:crypto";

import { queryOne, queryRows } from "./pool.mjs";

export const TEST_EMAIL_DOMAIN = "example.invalid";
export const TEST_EMAIL_PREFIX = "otp-it+";
export const TEST_EMAIL_PATTERN = /^otp-it\+[a-z0-9-]+@example\.invalid$/;

/** Unique per process; every mailbox created here carries this run id. */
export const RUN_ID = `${process.pid.toString(36)}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
export const RUN_EMAIL_PREFIX = `${TEST_EMAIL_PREFIX}${RUN_ID}-`;

let sequence = 0;

function affectedRows(result) {
  return Number(result && result.affectedRows ? result.affectedRows : 0);
}

/**
 * Escapes LIKE metacharacters with `!`, which emails never contain, so the
 * prefix scan cannot widen if a run id ever gains a `%` or `_`.
 */
function escapeLike(value) {
  return String(value).replace(/[!%_]/g, (match) => `!${match}`);
}

export function isTestEmail(email) {
  return typeof email === "string" && TEST_EMAIL_PATTERN.test(email);
}

/** Unique, RFC 2606 reserved (.invalid) mailbox for this test process. */
export function makeTestEmail(label = "user") {
  sequence += 1;
  const safeLabel =
    String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 16) || "user";
  const local = `${RUN_EMAIL_PREFIX}${sequence}-${safeLabel}`.slice(0, 64);
  return `${local}@${TEST_EMAIL_DOMAIN}`;
}

/**
 * Deletes exactly one test-owned user.
 *
 * The row is re-read first: the ids this module deletes are only trusted when
 * the stored e-mail still matches the registered test address, so a
 * mis-registered id can never take a real account's challenge or session history
 * with it.
 */
async function deleteTestUser(pool, user) {
  if (!isTestEmail(user.email)) {
    throw new Error("Refusing to delete a user outside the integration-test namespace.");
  }
  if (!Number.isInteger(user.id) || user.id <= 0) {
    throw new Error("Refusing to delete a user without a positive id.");
  }

  const owner = await queryOne(pool, "SELECT id, email FROM users WHERE id = ? LIMIT 1", [user.id]);
  if (!owner) {
    throw new Error("Refusing to clean up an integration-test user that no longer exists.");
  }
  if (String(owner.email).toLowerCase() !== user.email.toLowerCase()) {
    throw new Error(
      "Refusing to clean up a user whose stored e-mail does not match the registered test row.",
    );
  }

  const [challenges] = await pool.query(
    "DELETE FROM verification_challenges WHERE user_id = ?",
    [user.id],
  );
  const [sessions] = await pool.query("DELETE FROM sessions WHERE user_id = ?", [user.id]);
  const [users] = await pool.query("DELETE FROM users WHERE id = ? AND email = ?", [
    user.id,
    user.email,
  ]);

  if (affectedRows(users) !== 1) {
    throw new Error("Integration-test cleanup did not delete exactly one owned user.");
  }
  return {
    id: user.id,
    email: user.email,
    challenges: affectedRows(challenges),
    sessions: affectedRows(sessions),
    users: affectedRows(users),
  };
}

export class TestAccountRegistry {
  constructor(pool) {
    this.pool = pool;
    this.entries = [];
    this.ids = new Set();
  }

  get size() {
    return this.entries.length;
  }

  /** Creates a fresh unverified (or explicitly verified) test user. */
  async create({ label = "user", name = "OTP Integration User", verifiedAt = null } = {}) {
    return this.insertUser({ email: makeTestEmail(label), name, verifiedAt });
  }

  async insertUser({ email, name = "OTP Integration User", verifiedAt = null }) {
    if (!isTestEmail(email)) {
      throw new Error("Refusing to create a user outside the integration-test namespace.");
    }
    if (await queryOne(this.pool, "SELECT id FROM users WHERE email = ? LIMIT 1", [email])) {
      throw new Error("Refusing to reuse an existing user for integration tests.");
    }

    const verifiedSeconds = verifiedAt === null ? null : Math.floor(verifiedAt / 1000);
    const [result] = await this.pool.query(
      "INSERT INTO users (email, name, role, password_hash, email_verified_at) " +
        "VALUES (?, ?, 'user', NULL, IF(? IS NULL, NULL, FROM_UNIXTIME(?)))",
      [email, name, verifiedSeconds, verifiedSeconds],
    );
    const id = Number(result && result.insertId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Integration-test user insert did not return an id.");
    }
    return this.register({ id, email });
  }

  /** Registers a user already created by AuthService.signup. */
  register({ id, email }) {
    if (!isTestEmail(email)) {
      throw new Error("Refusing to track a user outside the integration-test namespace.");
    }
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new Error("Refusing to track a user without a positive id.");
    }
    if (this.ids.has(numericId)) {
      return this.entries.find((entry) => entry.id === numericId);
    }
    const entry = { id: numericId, email };
    this.entries.push(entry);
    this.ids.add(numericId);
    return entry;
  }

  /**
   * Registers a user created by AuthService.signup. Safe to call after a signup
   * that threw: the row may already exist even though no id was returned.
   */
  async registerByEmail(email) {
    if (!isTestEmail(email)) {
      throw new Error("Refusing to track a user outside the integration-test namespace.");
    }
    const row = await queryOne(this.pool, "SELECT id, email FROM users WHERE email = ? LIMIT 1", [
      email,
    ]);
    return row ? this.register({ id: row.id, email: row.email }) : null;
  }

  /**
   * Finds users created under this process's run prefix that were never tracked
   * (a signup that inserted the row and then failed to deliver the code) and
   * registers them so the normal cleanup removes them.
   */
  async reconcileRun() {
    const rows = await queryRows(
      this.pool,
      "SELECT id, email FROM users WHERE email LIKE ? ESCAPE '!' ORDER BY id",
      [`${escapeLike(RUN_EMAIL_PREFIX)}%`],
    );

    const reconciled = [];
    for (const row of rows) {
      const email = String(row.email);
      if (!isTestEmail(email)) continue;
      if (!email.toLowerCase().startsWith(RUN_EMAIL_PREFIX)) continue;
      reconciled.push(this.register({ id: row.id, email }));
    }
    return reconciled;
  }

  /**
   * Deletes exactly the tracked users. Keeps failed entries so a caller can
   * retry; successful entries are removed from the registry. The caller decides
   * whether a partial failure is fatal (see `dispose`).
   */
  async cleanup() {
    const failures = [];
    const deleted = [];
    for (const entry of [...this.entries].reverse()) {
      try {
        deleted.push(await deleteTestUser(this.pool, entry));
        this.entries = this.entries.filter((candidate) => candidate.id !== entry.id);
        this.ids.delete(entry.id);
      } catch (error) {
        failures.push(error);
      }
    }
    return { deleted, failures };
  }

  /**
   * Verifies with database queries that the deleted ids left no user, challenge
   * or session row behind, and that no user with this run's prefix survives.
   */
  async assertClean(deleted = []) {
    for (const entry of deleted) {
      const counts = await queryOne(
        this.pool,
        "SELECT (SELECT COUNT(*) FROM users WHERE id = ?) AS users, " +
          "(SELECT COUNT(*) FROM verification_challenges WHERE user_id = ?) AS challenges, " +
          "(SELECT COUNT(*) FROM sessions WHERE user_id = ?) AS sessions",
        [entry.id, entry.id, entry.id],
      );
      if (
        Number(counts?.users) !== 0 ||
        Number(counts?.challenges) !== 0 ||
        Number(counts?.sessions) !== 0
      ) {
        throw new Error("Integration-test rows remain after cleanup.");
      }
    }

    const remaining = await queryOne(
      this.pool,
      "SELECT COUNT(*) AS total FROM users WHERE email LIKE ? ESCAPE '!'",
      [`${escapeLike(RUN_EMAIL_PREFIX)}%`],
    );
    if (Number(remaining?.total) !== 0) {
      throw new Error("Integration-test users from this run remain after cleanup.");
    }
  }

  /**
   * Full teardown for `after()`: reconcile untracked rows, delete every tracked
   * user, then prove with queries that nothing is left. Throws after verification
   * so the test file fails loudly instead of leaving rows behind silently.
   */
  async dispose() {
    await this.reconcileRun();
    const result = await this.cleanup();

    let verificationError = null;
    try {
      await this.assertClean(result.deleted);
    } catch (error) {
      verificationError = error;
    }

    if (result.failures.length > 0) {
      const errors = [...result.failures];
      if (verificationError) errors.push(verificationError);
      throw new AggregateError(errors, "Integration-test cleanup failed.");
    }
    if (verificationError) throw verificationError;

    return result;
  }
}
