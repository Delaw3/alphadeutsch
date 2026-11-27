import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./preload.cjs");

const { MySqlSessionStore } = require("../build/auth/mysql-sessions.js");

/**
 * Minimal stand-in for `mysql2/promise`'s `query()` that resolves the exact
 * tuple shape the driver produces: `[ResultSetHeader, fields]`.
 *
 * For INSERT/UPDATE/DELETE the second element is `undefined`; the write metadata
 * (`affectedRows`, `insertId`) is on the FIRST element. Regression guard: reading
 * `.affectedRows` off the second element throws a TypeError which the store
 * reported as a 500 "Account service is unavailable.", breaking password reset.
 */
class FakePool {
  constructor({ affectedRows = 0, error = null } = {}) {
    this.affectedRows = affectedRows;
    this.error = error;
    this.calls = [];
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    if (this.error) throw this.error;
    return [{ affectedRows: this.affectedRows, insertId: 7 }, undefined];
  }
}

describe("MySQL session store", () => {
  it("revokeAllForUser returns the row count from the result header", async () => {
    const pool = new FakePool({ affectedRows: 3 });
    const store = new MySqlSessionStore(pool);

    assert.equal(await store.revokeAllForUser(42), 3);
    assert.deepEqual(pool.calls, [{ sql: "DELETE FROM sessions WHERE user_id = ?", params: [42] }]);
  });

  it("revokeAllForUser returns 0 when no session matched", async () => {
    const store = new MySqlSessionStore(new FakePool({ affectedRows: 0 }));
    assert.equal(await store.revokeAllForUser(42), 0);
  });

  it("revokeByTokenHash reports whether a row was deleted", async () => {
    const hash = "a".repeat(64);

    const removed = new MySqlSessionStore(new FakePool({ affectedRows: 1 }));
    assert.equal(await removed.revokeByTokenHash(hash), true);

    const missing = new MySqlSessionStore(new FakePool({ affectedRows: 0 }));
    assert.equal(await missing.revokeByTokenHash(hash), false);
  });

  it("deleteExpired converts the millisecond cutoff to seconds", async () => {
    const pool = new FakePool({ affectedRows: 2 });
    const store = new MySqlSessionStore(pool);
    const now = 1_700_000_000_123;

    assert.equal(await store.deleteExpired(now), 2);
    assert.deepEqual(pool.calls, [
      {
        sql: "DELETE FROM sessions WHERE expires_at <= FROM_UNIXTIME(?)",
        params: [Math.floor(now / 1000)],
      },
    ]);
  });

  it("still reports real driver failures as store-error", async () => {
    const denied = Object.assign(new Error("DELETE command denied"), {
      code: "ER_TABLEACCESS_DENIED_ERROR",
    });
    const store = new MySqlSessionStore(new FakePool({ error: denied }));

    await assert.rejects(
      () => store.revokeAllForUser(42),
      (error) => error.code === "store-error" && error.status === 500,
    );
  });
});
