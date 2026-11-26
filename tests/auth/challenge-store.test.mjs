import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../auth/preload.cjs");

const {
  hashOtp,
  isValidOtp,
  readCodePepper,
  verifyOtpHash,
  digestsEqual,
  OtpConfigError,
} = require("../build/auth/otp.js");
const { MySqlChallengeStore } = require("../build/auth/mysql-challenges.js");
const {
  MemoryChallengeStore,
  consumeChallenge,
  CHALLENGE_CLEANUP_BATCH_SIZE,
  VERIFY_CODE_TTL_MS,
  VERIFY_CODE_MAX_ATTEMPTS,
  VERIFY_RESEND_COOLDOWN_MS,
} = require("../build/auth/verification.js");
const { AuthError } = require("../build/auth/auth-errors.js");

const USER_ID = 7;
const PEPPER = process.env.AUTH_CODE_PEPPER;

function cloneRow(row) {
  return {
    ...row,
    expires_at: new Date(row.expires_at),
    used_at: row.used_at === null ? null : new Date(row.used_at),
    created_at: new Date(row.created_at),
    last_sent_at: new Date(row.last_sent_at),
  };
}

function makeRow(overrides = {}) {
  const now = Date.now();
  return {
    id: 1,
    user_id: USER_ID,
    purpose: "signup",
    code_hash: hashOtp("123456"),
    expires_at: new Date(now + VERIFY_CODE_TTL_MS),
    used_at: null,
    attempts: 0,
    created_at: new Date(now),
    last_sent_at: new Date(now),
    ...overrides,
  };
}

function makeDbChallenge(overrides = {}) {
  return {
    id: "challenge-1",
    userId: USER_ID,
    purpose: "signup",
    codeHash: hashOtp("123456"),
    expiresAt: Date.now() + VERIFY_CODE_TTL_MS,
    usedAt: null,
    attempts: 0,
    createdAt: Date.now(),
    lastSentAt: Date.now(),
    ...overrides,
  };
}

class FakeConnection {
  constructor(pool) {
    this.pool = pool;
    this.rows = pool.rows.map(cloneRow);
    this.nextId = pool.nextId;
    this.initialRows = this.rows.map(cloneRow);
    this.verifiedUsers = new Set(pool.verifiedUsers);
    this.initialVerifiedUsers = new Set(pool.verifiedUsers);
    this.calls = pool.calls;
    this.committed = false;
    this.rolledBack = false;
  }

  async beginTransaction() {
    this.calls.push({ sql: "BEGIN", params: [] });
  }

  async commit() {
    this.calls.push({ sql: "COMMIT", params: [] });
    this.pool.rows = this.rows.map(cloneRow);
    this.pool.nextId = this.nextId;
    this.pool.verifiedUsers = new Set(this.verifiedUsers);
    this.committed = true;
  }

  async rollback() {
    this.calls.push({ sql: "ROLLBACK", params: [] });
    this.rows = this.initialRows.map(cloneRow);
    this.verifiedUsers = new Set(this.initialVerifiedUsers);
    this.rolledBack = true;
  }

  release() {
    this.calls.push({ sql: "RELEASE", params: [] });
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    return respond(this, sql, params);
  }
}

class FakePool {
  constructor(rows = []) {
    this.rows = rows.map(cloneRow);
    this.nextId = Math.max(0, ...rows.map((row) => Number(row.id))) + 1;
    this.calls = [];
    this.failOn = null;
    this.failGetConnection = false;
    this.users = new Set([USER_ID]);
    this.verifiedUsers = new Set();
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    return respond(this, sql, params);
  }

  async getConnection() {
    if (this.failGetConnection) throw new Error("simulated pool acquisition failure");
    return new FakeConnection(this);
  }
}

function respond(target, sql, params) {
  const source = target.pool ?? target;
  if (source.failOn && sql.includes(source.failOn)) {
    return Promise.reject(new Error("simulated database failure"));
  }

  const text = sql.replace(/\s+/g, " ").trim();

  if (text.includes("SELECT id") && text.includes("FROM users")) {
    const userId = Number(params[0]);
    return Promise.resolve([
      source.users.has(userId)
        ? [
            {
              id: userId,
              email_verified_at: source.verifiedUsers.has(userId) ? new Date(0) : null,
            },
          ]
        : [],
      [],
    ]);
  }

  if (text.includes("SELECT attempts FROM verification_challenges")) {
    const row = target.rows.find((candidate) => String(candidate.id) === String(params[0]));
    return Promise.resolve([[row ? { attempts: row.attempts } : undefined].filter(Boolean), []]);
  }

  if (text.includes("FROM verification_challenges") && text.startsWith("SELECT")) {
    const matching = target.rows
      .filter((row) => row.user_id === Number(params[0]) && row.purpose === params[1])
      .sort(
        (left, right) =>
          right.created_at.getTime() - left.created_at.getTime() ||
          Number(right.id) - Number(left.id),
      );
    return Promise.resolve([matching.slice(0, 1).map(cloneRow), []]);
  }

  if (text.startsWith("INSERT INTO verification_challenges")) {
    const id = target.nextId++;
    target.rows.push({
      id,
      user_id: Number(params[0]),
      purpose: params[1],
      code_hash: params[2],
      expires_at: new Date(Number(params[3]) * 1000),
      used_at: params[4] === null ? null : new Date(Number(params[4]) * 1000),
      attempts: Number(params[6]),
      created_at: new Date(Number(params[7]) * 1000),
      last_sent_at: new Date(Number(params[8]) * 1000),
    });
    return Promise.resolve([{ insertId: id }, []]);
  }

  if (text.includes("UPDATE users") && text.includes("SET email_verified_at")) {
    target.verifiedUsers.add(Number(params[1]));
    return Promise.resolve([{ affectedRows: 1 }, []]);
  }

  if (text.includes("SET attempts = attempts + 1")) {
    const row = target.rows.find((candidate) => String(candidate.id) === String(params[0]));
    const changed = Boolean(row && row.attempts < Number(params[1]));
    if (changed) row.attempts += 1;
    return Promise.resolve([{ affectedRows: changed ? 1 : 0 }, []]);
  }

  if (text.includes("SET used_at") && text.includes("WHERE user_id")) {
    let changed = 0;
    for (const row of target.rows) {
      if (row.user_id === Number(params[1]) && row.purpose === params[2] && row.used_at === null) {
        row.used_at = new Date(Number(params[0]) * 1000);
        changed += 1;
      }
    }
    return Promise.resolve([{ affectedRows: changed }, []]);
  }

  if (text.includes("SET used_at") && text.includes("WHERE id")) {
    const row = target.rows.find((candidate) => String(candidate.id) === String(params[1]));
    const changed = Boolean(row && row.used_at === null);
    if (changed) row.used_at = new Date(Number(params[0]) * 1000);
    return Promise.resolve([{ affectedRows: changed ? 1 : 0 }, []]);
  }

  if (text.startsWith("DELETE FROM verification_challenges")) {
    const cutoff = Number(params[0]) * 1000;
    const limitMatch = /\bLIMIT\s+(\d+)/i.exec(text);
    const limit = limitMatch ? Number(limitMatch[1]) : Infinity;
    const expired = target.rows.filter((row) => row.expires_at.getTime() <= cutoff);
    const remove = new Set(expired.slice(0, limit).map((row) => row.id));
    target.rows = target.rows.filter((row) => !remove.has(row.id));
    return Promise.resolve([{ affectedRows: remove.size }, []]);
  }

  return Promise.reject(new Error(`Unhandled fake SQL: ${text}`));
}


describe("OTP HMAC protection", () => {
  it("produces a 64-character HMAC-SHA256 digest and compares it", () => {
    const digest = hashOtp("123456");
    assert.equal(
      digest,
      "a314a2c84ff5774e40fefffdc0b3b7d6819323ebb37c116ac96107bb84101533",
    );
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.notEqual(digest, "123456");
    assert.equal(digest, hashOtp("123456"));
    assert.equal(verifyOtpHash("123456", digest), true);
    assert.equal(verifyOtpHash("654321", digest), false);
    assert.equal(digestsEqual(digest, digest), true);
    assert.equal(digestsEqual(digest, digest.slice(0, -1)), false);
  });

  it("fails closed when the pepper is missing or invalid", () => {
    assert.throws(() => hashOtp("123456", {}), (error) => error instanceof OtpConfigError);
    for (const invalid of [
      "too-short",
      "a".repeat(63),
      "a".repeat(65),
      "g".repeat(64),
      `${"a".repeat(63)} `,
      `${"a".repeat(63)}\u0000`,
    ]) {
      assert.throws(
        () => readCodePepper({ AUTH_CODE_PEPPER: invalid }),
        (error) => error instanceof OtpConfigError && error.code === "store-error",
      );
    }
    assert.equal(readCodePepper({ AUTH_CODE_PEPPER: "A".repeat(64) }), "A".repeat(64));
    assert.equal(readCodePepper({ AUTH_CODE_PEPPER: PEPPER }), PEPPER);
  });

  it("rejects OTP values that are not exactly six digits", () => {
    for (const code of ["", "12345", "1234567", "abcdef", "123 456", "00000a"]) {
      assert.equal(isValidOtp(code), false);
      assert.throws(
        () => hashOtp(code),
        (error) => error instanceof AuthError && error.code === "code-invalid",
      );
      assert.equal(verifyOtpHash(code, hashOtp("123456")), false);
    }
    assert.equal(isValidOtp("000000"), true);
    assert.equal(hashOtp(" 000000 "), hashOtp("000000"));
  });

  it("does not log the OTP or pepper", () => {
    const originalLog = console.log;
    const calls = [];
    console.log = (...args) => calls.push(args);
    try {
      const digest = hashOtp("123456");
      verifyOtpHash("123456", digest);
    } finally {
      console.log = originalLog;
    }
    assert.deepEqual(calls, []);
  });
});

describe("memory challenge provider", () => {
  it("enforces the 10-minute TTL and six-digit policy", () => {
    assert.equal(VERIFY_CODE_TTL_MS, 10 * 60_000);
    assert.equal(VERIFY_CODE_MAX_ATTEMPTS, 5);
    assert.equal(VERIFY_RESEND_COOLDOWN_MS, 60_000);
  });

  it("serializes concurrent issues so only one code is created", async () => {
    const store = new MemoryChallengeStore();
    const now = Date.now();
    const first = makeDbChallenge({ id: "first", createdAt: now, lastSentAt: now });
    const second = makeDbChallenge({ id: "second", createdAt: now, lastSentAt: now });

    const results = await Promise.all([
      store.issue({ challenge: first, cooldownMs: VERIFY_RESEND_COOLDOWN_MS, now }),
      store.issue({ challenge: second, cooldownMs: VERIFY_RESEND_COOLDOWN_MS, now }),
    ]);

    assert.equal(results.filter((result) => result.status === "created").length, 1);
    assert.equal(results.filter((result) => result.status === "cooldown").length, 1);
    assert.equal((await store.latestForUser(USER_ID, "signup")).id, "first");
  });

  it("supersedes an old active challenge when a new one is issued", async () => {
    const store = new MemoryChallengeStore();
    const now = Date.now();
    const first = makeDbChallenge({ id: "first", createdAt: now, lastSentAt: now });
    const second = makeDbChallenge({
      id: "second",
      createdAt: now + 61_000,
      lastSentAt: now + 61_000,
    });

    await store.issue({ challenge: first, cooldownMs: VERIFY_RESEND_COOLDOWN_MS, now });
    await store.issue({
      challenge: second,
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now: now + 61_000,
    });

    const old = await store.latestForUser(USER_ID, "signup");
    assert.equal(old.id, "second");
  });

  it("consumes once, rejects replay, and removes expired rows", async () => {
    const store = new MemoryChallengeStore();
    const challenge = makeDbChallenge();
    await store.saveForTest(challenge);

    assert.equal((await store.consume({
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now: challenge.createdAt,
    })).status, "consumed");
    assert.equal((await store.consume({
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now: challenge.createdAt,
    })).status, "used");

    const expired = makeDbChallenge({
      id: "expired",
      expiresAt: challenge.createdAt - 1,
    });
    const expiredStore = new MemoryChallengeStore();
    await expiredStore.saveForTest(expired);
    assert.equal((await expiredStore.consume({
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now: challenge.createdAt,
    })).status, "expired");

    assert.equal(await store.deleteExpired(challenge.createdAt), 0);
    assert.equal(await expiredStore.deleteExpired(challenge.createdAt), 1);
  });
});


describe("MySQL challenge provider", () => {
  it("returns the latest challenge ordered by creation time and id", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ id: 1, created_at: new Date(now - 1000) }),
      makeRow({ id: 2, created_at: new Date(now) }),
    ]);
    const store = new MySqlChallengeStore(pool);

    const latest = await store.latestForUser(USER_ID, "signup");
    assert.equal(latest.id, "2");
    assert.match(pool.calls[0].sql, /ORDER BY created_at DESC, id DESC LIMIT 1$/);
  });

  it("inserts only the digest using parameterized SQL", async () => {
    const pool = new FakePool();
    const store = new MySqlChallengeStore(pool);
    const challenge = makeDbChallenge();

    const result = await store.issue({
      challenge,
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now: challenge.createdAt,
    });
    const insertCall = pool.calls.find((call) => call.sql.startsWith("INSERT INTO"));

    assert.equal(result.status, "created");
    assert.ok(insertCall);
    assert.match(insertCall.sql, /\?/);
    assert.equal(insertCall.params[2], challenge.codeHash);
    assert.equal(JSON.stringify(insertCall.params).includes("123456"), false);
    assert.equal(result.challenge.id, "1");
    assert.equal(pool.rows.length, 1);
    assert.equal(pool.rows[0].code_hash, challenge.codeHash);
    assert.equal(pool.rows[0].used_at, null);
  });

  it("creates a challenge inside a user-locked transaction", async () => {
    const pool = new FakePool();
    const store = new MySqlChallengeStore(pool);
    const challenge = makeDbChallenge();

    const result = await store.issue({
      challenge,
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now: challenge.createdAt,
    });

    assert.equal(result.status, "created");
    assert.equal(result.challenge.id, "1");
    const sqls = pool.calls.map((call) => call.sql);
    assert.ok(sqls.includes("BEGIN"));
    assert.ok(sqls.some((sql) => sql.includes("SELECT id") && sql.includes("FROM users") && sql.includes("FOR UPDATE")));
    assert.ok(sqls.some((sql) => sql.includes("FROM verification_challenges") && sql.includes("FOR UPDATE")));
    assert.ok(sqls.includes("COMMIT"));
    assert.ok(sqls.includes("RELEASE"));
    assert.equal(pool.rows.length, 1);
  });

  it("enforces the resend cooldown across a second issue", async () => {
    const pool = new FakePool();
    const store = new MySqlChallengeStore(pool);
    const now = Date.now();
    const first = makeDbChallenge({ createdAt: now, lastSentAt: now });

    await store.issue({ challenge: first, cooldownMs: VERIFY_RESEND_COOLDOWN_MS, now });
    const callsBefore = pool.calls.length;

    const second = makeDbChallenge({
      id: "second",
      createdAt: now + 1000,
      lastSentAt: now + 1000,
    });
    const result = await store.issue({
      challenge: second,
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now: now + 1000,
    });

    assert.equal(result.status, "cooldown");
    assert.equal(pool.rows.length, 1);
    assert.equal(
      pool.calls.slice(callsBefore).filter((call) => call.sql.startsWith("INSERT INTO")).length,
      0,
    );
  });

  it("supersedes the previous active row after the cooldown", async () => {
    const pool = new FakePool();
    const store = new MySqlChallengeStore(pool);
    const now = Date.now();

    await store.issue({
      challenge: makeDbChallenge({ createdAt: now, lastSentAt: now }),
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now,
    });
    await store.issue({
      challenge: makeDbChallenge({
        id: "second",
        createdAt: now + 61_000,
        lastSentAt: now + 61_000,
      }),
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now: now + 61_000,
    });

    assert.equal(pool.rows.length, 2);
    assert.notEqual(pool.rows[0].used_at, null);
    assert.equal(pool.rows[1].used_at, null);
  });


  it("consumes a challenge once and rejects duplicate consumption", async () => {
    const now = Date.now();
    const pool = new FakePool([makeRow({ created_at: new Date(now), last_sent_at: new Date(now) })]);
    const store = new MySqlChallengeStore(pool);
    const input = {
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now,
    };

    const first = await store.consume(input);
    assert.equal(first.status, "consumed");
    assert.notEqual(pool.rows[0].used_at, null);

    const second = await store.consume(input);
    assert.equal(second.status, "used");
    const usedUpdates = pool.calls.filter(
      (call) => call.sql.includes("SET used_at") && call.sql.includes("WHERE id"),
    );
    assert.equal(usedUpdates.length, 1);
  });

  it("increments attempts atomically and stops at five", async () => {
    const now = Date.now();
    const pool = new FakePool([makeRow({ created_at: new Date(now), last_sent_at: new Date(now) })]);
    const store = new MySqlChallengeStore(pool);
    const wrong = {
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("000000"),
      maxAttempts: VERIFY_CODE_MAX_ATTEMPTS,
      now,
    };

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await store.consume(wrong);
      assert.equal(result.status, "invalid");
      assert.equal(pool.rows[0].attempts, attempt);
    }
    const fifth = await store.consume(wrong);
    assert.equal(fifth.status, "attempts-exceeded");
    assert.equal(pool.rows[0].attempts, 5);

    const correctButLocked = await store.consume({
      ...wrong,
      codeHash: hashOtp("123456"),
    });
    assert.equal(correctButLocked.status, "attempts-exceeded");
  });

  it("increments the public attempt counter without exceeding the cap", async () => {
    const pool = new FakePool([makeRow({ attempts: 4 })]);
    const store = new MySqlChallengeStore(pool);

    assert.equal(await store.incrementAttempts("1", 5), 5);
    assert.equal(await store.incrementAttempts("1", 5), 5);
    assert.equal(pool.rows[0].attempts, 5);
  });

  it("rejects expired challenges", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({
        expires_at: new Date(now - 1),
        created_at: new Date(now - 1000),
        last_sent_at: new Date(now - 1000),
      }),
    ]);
    const store = new MySqlChallengeStore(pool);

    const result = await store.consume({
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now,
    });
    assert.equal(result.status, "expired");
    assert.equal(pool.rows[0].used_at, null);
  });

  it("deletes expired rows without touching active rows", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ id: 1, expires_at: new Date(now - 2000) }),
      makeRow({ id: 2, expires_at: new Date(now + 60_000) }),
    ]);
    const store = new MySqlChallengeStore(pool);

    assert.equal(await store.deleteExpired(now), 1);
    assert.equal(pool.rows.length, 1);
    assert.equal(pool.rows[0].id, 2);
  });

  it("rolls back and returns a generic store error when insertion fails", async () => {
    const pool = new FakePool();
    pool.failOn = "INSERT INTO verification_challenges";
    const store = new MySqlChallengeStore(pool);
    const challenge = makeDbChallenge();

    await assert.rejects(
      store.issue({ challenge, cooldownMs: VERIFY_RESEND_COOLDOWN_MS, now: challenge.createdAt }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );

    const sqls = pool.calls.map((call) => call.sql);
    assert.ok(sqls.includes("ROLLBACK"));
    assert.equal(sqls.includes("COMMIT"), false);
    assert.equal(pool.rows.length, 0);
  });

  it("rolls back a failed consumption", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ created_at: new Date(now), last_sent_at: new Date(now) }),
    ]);
    pool.failOn = "UPDATE verification_challenges SET used_at";
    const store = new MySqlChallengeStore(pool);

    await assert.rejects(
      store.consume({
        userId: USER_ID,
        purpose: "signup",
        codeHash: hashOtp("123456"),
        maxAttempts: 5,
        now,
      }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );

    assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
    assert.equal(pool.rows[0].used_at, null);
  });

  it("does not log OTP values or the pepper during adapter operations", async () => {
    const pool = new FakePool();
    const store = new MySqlChallengeStore(pool);
    const challenge = makeDbChallenge();
    const originalLog = console.log;
    const calls = [];
    console.log = (...args) => calls.push(args);
    try {
      await store.issue({
        challenge,
        cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
        now: challenge.createdAt,
      });
    } finally {
      console.log = originalLog;
    }
    assert.deepEqual(calls, []);
  });
});


describe("MySQL atomic verification", () => {
  it("consumes the challenge and verifies the user in one transaction", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ created_at: new Date(now), last_sent_at: new Date(now) }),
    ]);
    const store = new MySqlChallengeStore(pool);

    const result = await store.consumeAndVerify({
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now,
      verifyUser: async () => {
        throw new Error("MySQL must perform the user update itself");
      },
    });

    assert.equal(result.status, "consumed");
    assert.equal(pool.verifiedUsers.has(USER_ID), true);
    assert.notEqual(pool.rows[0].used_at, null);
    assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
    assert.ok(pool.calls.some((call) => call.sql.includes("UPDATE users")));
    assert.ok(pool.calls.some((call) => call.sql === "RELEASE"));
  });

  it("rolls back the challenge when the user verification update fails", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ created_at: new Date(now), last_sent_at: new Date(now) }),
    ]);
    pool.failOn = "UPDATE users SET email_verified_at";
    const store = new MySqlChallengeStore(pool);

    await assert.rejects(
      store.consumeAndVerify({
        userId: USER_ID,
        purpose: "signup",
        codeHash: hashOtp("123456"),
        maxAttempts: 5,
        now,
        verifyUser: async () => undefined,
      }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );

    assert.equal(pool.rows[0].used_at, null);
    assert.equal(pool.verifiedUsers.has(USER_ID), false);
    assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
    assert.equal(pool.calls.some((call) => call.sql === "COMMIT"), false);
    assert.ok(pool.calls.some((call) => call.sql === "RELEASE"));
  });

  it("rolls back and leaves the user unverified when challenge consumption fails", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ created_at: new Date(now), last_sent_at: new Date(now) }),
    ]);
    pool.failOn = "UPDATE verification_challenges SET used_at";
    const store = new MySqlChallengeStore(pool);

    await assert.rejects(
      store.consumeAndVerify({
        userId: USER_ID,
        purpose: "signup",
        codeHash: hashOtp("123456"),
        maxAttempts: 5,
        now,
        verifyUser: async () => undefined,
      }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );

    assert.equal(pool.rows[0].used_at, null);
    assert.equal(pool.verifiedUsers.has(USER_ID), false);
    assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
    assert.ok(pool.calls.some((call) => call.sql === "RELEASE"));
  });

  it("does not verify the user again on a repeated request", async () => {
    const now = Date.now();
    const pool = new FakePool([
      makeRow({ created_at: new Date(now), last_sent_at: new Date(now) }),
    ]);
    const store = new MySqlChallengeStore(pool);
    const input = {
      userId: USER_ID,
      purpose: "signup",
      codeHash: hashOtp("123456"),
      maxAttempts: 5,
      now,
      verifyUser: async () => undefined,
    };

    assert.equal((await store.consumeAndVerify(input)).status, "consumed");
    assert.equal((await store.consumeAndVerify(input)).status, "used");
    assert.equal(
      pool.calls.filter((call) => call.sql.includes("UPDATE users")).length,
      1,
    );
  });
});


describe("challenge hardening", () => {
  it("rejects signup issuance for an already-verified memory account", async () => {
    const store = new MemoryChallengeStore();
    const now = Date.now();
    const result = await store.issue({
      challenge: makeDbChallenge({ createdAt: now, lastSentAt: now }),
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now,
      isUserVerified: async () => true,
    });

    assert.equal(result.status, "already-verified");
    assert.equal(store.size, 0);
  });

  it("rejects signup issuance for an already-verified MySQL account", async () => {
    const pool = new FakePool();
    pool.verifiedUsers.add(USER_ID);
    const store = new MySqlChallengeStore(pool);
    const challenge = makeDbChallenge();

    const result = await store.issue({
      challenge,
      cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
      now: challenge.createdAt,
    });

    assert.equal(result.status, "already-verified");
    assert.equal(pool.rows.length, 0);
    assert.equal(
      pool.calls.filter((call) => call.sql.startsWith("INSERT INTO")).length,
      0,
    );
    assert.ok(pool.calls.some((call) => call.sql === "COMMIT"));
  });

  it("fails closed when a caller supplies verification without an atomic store method", async () => {
    const fakeStore = {
      consume: async () => ({ status: "consumed", challenge: makeDbChallenge() }),
    };

    await assert.rejects(
      consumeChallenge(
        fakeStore,
        { userId: USER_ID, purpose: "signup", code: "123456" },
        async () => undefined,
      ),
      (error) => error instanceof AuthError && error.code === "store-error",
    );
  });

  it("maps pool acquisition failures to a generic store error", async () => {
    const pool = new FakePool();
    pool.failGetConnection = true;
    const store = new MySqlChallengeStore(pool);
    const challenge = makeDbChallenge();

    await assert.rejects(
      store.issue({
        challenge,
        cooldownMs: VERIFY_RESEND_COOLDOWN_MS,
        now: challenge.createdAt,
      }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );
    await assert.rejects(
      store.consumeAndVerify({
        userId: USER_ID,
        purpose: "signup",
        codeHash: hashOtp("123456"),
        maxAttempts: 5,
        now: challenge.createdAt,
        verifyUser: async () => undefined,
      }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );
    assert.equal(pool.calls.some((call) => call.sql === "RELEASE"), false);
  });

  it("bounds expired cleanup and preserves active rows", async () => {
    const now = Date.now();
    const expiredRows = Array.from({ length: 150 }, (_, index) =>
      makeRow({
        id: index + 1,
        expires_at: new Date(now - 2000),
        created_at: new Date(now - 10_000),
        last_sent_at: new Date(now - 10_000),
      }),
    );
    const pool = new FakePool([
      ...expiredRows,
      makeRow({ id: 999, expires_at: new Date(now + 60_000) }),
    ]);
    const store = new MySqlChallengeStore(pool);

    assert.equal(await store.deleteExpired(now, 100), 100);
    assert.equal(pool.rows.length, 51);
    assert.equal(pool.rows.some((row) => String(row.id) === "999"), true);
    assert.equal(CHALLENGE_CLEANUP_BATCH_SIZE, 100);
  });

  it("bounds memory cleanup to the requested batch", async () => {
    const now = Date.now();
    const store = new MemoryChallengeStore();
    for (let index = 0; index < 150; index += 1) {
      await store.saveForTest(
        makeDbChallenge({
          id: `expired-${index}`,
          expiresAt: now - 2000,
          createdAt: now - 10_000,
          lastSentAt: now - 10_000,
        }),
      );
    }
    assert.equal(await store.deleteExpired(now, 100), 100);
    assert.equal(store.size, 50);
  });
});
