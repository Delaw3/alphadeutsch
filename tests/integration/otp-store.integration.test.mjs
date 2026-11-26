// Real-MySQL coverage: persistence, TTL, cooldown and attempt limits.
//
// Uses MySqlChallengeStore directly with a dedicated test pool, so no global
// cleanup runs. Every row belongs to a registry-tracked user; `after()` (and the
// SIGINT/SIGTERM hook) reconciles this run's prefix, deletes those rows and
// verifies with queries that nothing remains.
import "./preload.cjs";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { TestAccountRegistry } from "./helpers/accounts.mjs";
import { loadIntegrationEnv } from "./helpers/env.mjs";
import {
  assertIntegrationEnvironment,
  assertLoopbackHost,
  assertWritableLocalAlphaDeutschTarget,
} from "./helpers/guard.mjs";
import { closePoolQuietly, createIntegrationPool, queryOne } from "./helpers/pool.mjs";
import { installSignalCleanup } from "./helpers/shutdown.mjs";
import {
  COOLDOWN_MS,
  MAX_ATTEMPTS,
  ONE_SECOND_MS,
  TTL_MS,
  buildChallenge,
  codeHashFor,
  wholeSecond,
} from "./helpers/time.mjs";

const require = createRequire(import.meta.url);
const { MySqlChallengeStore } = require("../build/auth/mysql-challenges.js");

const EXISTING_OTP = "000000";

let env;
let pool;
let registry;
let removeSignalCleanup = null;

before(async () => {
  env = loadIntegrationEnv();
  assertIntegrationEnvironment(env);
  await assertLoopbackHost(env.DB_HOST);
  pool = createIntegrationPool({
    host: env.DB_HOST.trim(),
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD ?? "",
    database: env.DB_NAME.trim(),
  });
  const target = await assertWritableLocalAlphaDeutschTarget(pool, env);
  assert.equal(target.writesAllowed, true);
  assert.equal(target.peerCheck, "loopback");
  assert.equal(target.accountScope, "loopback");
  // The gate also returns the verified privilege scope (table-scoped is the
  // minimum; "database" only when the schema holds nothing but these tables).
  assert.ok(["table", "database"].includes(target.privileges.grantScope));
  registry = new TestAccountRegistry(pool);
  removeSignalCleanup = installSignalCleanup(async () => {
    if (registry) await registry.dispose();
    await closePoolQuietly(pool);
  });
});

after(async () => {
  if (removeSignalCleanup) removeSignalCleanup();
  try {
    if (registry) await registry.dispose();
  } finally {
    await closePoolQuietly(pool);
  }
});

async function latestRow(userId) {
  return queryOne(
    pool,
    "SELECT id, user_id, purpose, code_hash, expires_at, used_at, attempts, " +
      "created_at, last_sent_at FROM verification_challenges " +
      "WHERE user_id = ? AND purpose = 'signup' ORDER BY id DESC LIMIT 1",
    [userId],
  );
}

async function rowCount(userId) {
  const row = await queryOne(
    pool,
    "SELECT COUNT(*) AS total FROM verification_challenges WHERE user_id = ?",
    [userId],
  );
  return Number(row.total);
}

describe("MySQL OTP store: persistence", () => {
  it("stores only the HMAC digest with a 10-minute lifetime", async () => {
    const user = await registry.create({ label: "persist" });
    const store = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    const code = "123456";
    const challenge = buildChallenge({ userId: user.id, code, now });

    const result = await store.issue({ challenge, cooldownMs: COOLDOWN_MS, now });
    assert.equal(result.status, "created");

    const row = await latestRow(user.id);
    assert.ok(row, "the challenge row must exist");
    assert.equal(String(row.id), result.challenge.id);
    assert.equal(Number(row.user_id), user.id);
    assert.equal(row.purpose, "signup");
    assert.match(String(row.code_hash), /^[0-9a-f]{64}$/);
    assert.equal(row.code_hash, codeHashFor(code));
    assert.notEqual(row.code_hash, code);
    assert.equal(Number(row.attempts), 0);
    assert.equal(row.used_at, null);
    assert.equal(row.expires_at.getTime() - row.created_at.getTime(), TTL_MS);
    assert.equal(row.last_sent_at.getTime(), row.created_at.getTime());
    assert.equal(await rowCount(user.id), 1);
  });
});

describe("MySQL OTP store: expiry", () => {
  it("rejects a challenge exactly at its 10-minute expiry", async () => {
    const user = await registry.create({ label: "expiry" });
    const store = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    const code = "654321";
    const challenge = buildChallenge({ userId: user.id, code, now });

    const issued = await store.issue({ challenge, cooldownMs: COOLDOWN_MS, now });
    assert.equal(issued.status, "created");

    const result = await store.consume({
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor(code),
      maxAttempts: MAX_ATTEMPTS,
      now: challenge.expiresAt,
    });
    assert.equal(result.status, "expired");

    const row = await latestRow(user.id);
    assert.equal(row.used_at, null, "an expired challenge is not marked used");
    assert.equal(Number(row.attempts), 0);
  });

  it("rejects a challenge once its window has passed without deleting it", async () => {
    const user = await registry.create({ label: "post-expiry" });
    const store = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    const code = "111111";
    const challenge = buildChallenge({ userId: user.id, code, now });

    const issued = await store.issue({ challenge, cooldownMs: COOLDOWN_MS, now });
    assert.equal(issued.status, "created");

    // No already-expired row is ever persisted: time moves forward through the
    // store's `now`, so a concurrently running application sweep (which deletes
    // `expires_at <= now` for every user) cannot remove this fixture.
    const result = await store.consume({
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor(code),
      maxAttempts: MAX_ATTEMPTS,
      now: challenge.expiresAt + ONE_SECOND_MS,
    });
    assert.equal(result.status, "expired");

    const row = await latestRow(user.id);
    assert.ok(row, "expiry is application-enforced; the row remains until cleanup");
    assert.equal(row.used_at, null);
    assert.equal(Number(row.attempts), 0);
  });
});

describe("MySQL OTP store: resend cooldown", () => {
  it("blocks inside 60 seconds and supersedes the old row after it", async () => {
    const user = await registry.create({ label: "cooldown" });
    const store = new MySqlChallengeStore(pool);
    const t0 = wholeSecond();

    const first = await store.issue({
      challenge: buildChallenge({ userId: user.id, now: t0 }),
      cooldownMs: COOLDOWN_MS,
      now: t0,
    });
    assert.equal(first.status, "created");

    const blocked = await store.issue({
      challenge: buildChallenge({ userId: user.id, now: t0 }),
      cooldownMs: COOLDOWN_MS,
      now: t0 + COOLDOWN_MS - 1000,
    });
    assert.equal(blocked.status, "cooldown");
    assert.equal(blocked.challenge.id, first.challenge.id);
    assert.equal(await rowCount(user.id), 1);

    const later = t0 + COOLDOWN_MS + 1000;
    const allowed = await store.issue({
      challenge: buildChallenge({ userId: user.id, now: later }),
      cooldownMs: COOLDOWN_MS,
      now: later,
    });
    assert.equal(allowed.status, "created");

    const [rows] = await pool.query(
      "SELECT id, used_at, last_sent_at FROM verification_challenges " +
        "WHERE user_id = ? ORDER BY id",
      [user.id],
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].used_at.getTime(), later);
    assert.equal(rows[1].used_at, null);
    assert.equal(rows[1].last_sent_at.getTime(), later);
  });
});

describe("MySQL OTP store: five incorrect attempts", () => {
  it("counts each miss, locks at five and refuses the correct code", async () => {
    const user = await registry.create({ label: "attempts" });
    const store = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    const correct = "424242";

    const issued = await store.issue({
      challenge: buildChallenge({ userId: user.id, code: correct, now }),
      cooldownMs: COOLDOWN_MS,
      now,
    });
    assert.equal(issued.status, "created");

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await store.consume({
        userId: user.id,
        purpose: "signup",
        codeHash: codeHashFor(EXISTING_OTP),
        maxAttempts: MAX_ATTEMPTS,
        now,
      });
      assert.equal(result.status, "invalid");
      assert.equal(result.attempts, attempt);
      const row = await latestRow(user.id);
      assert.equal(Number(row.attempts), attempt);
      assert.equal(row.used_at, null);
    }

    const fifth = await store.consume({
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor(EXISTING_OTP),
      maxAttempts: MAX_ATTEMPTS,
      now,
    });
    assert.equal(fifth.status, "attempts-exceeded");
    assert.equal(fifth.attempts, MAX_ATTEMPTS);

    const locked = await store.consume({
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor(correct),
      maxAttempts: MAX_ATTEMPTS,
      now,
    });
    assert.equal(locked.status, "attempts-exceeded");

    const row = await latestRow(user.id);
    assert.equal(Number(row.attempts), MAX_ATTEMPTS);
    assert.equal(row.used_at, null);
    const userRow = await queryOne(pool, "SELECT email_verified_at FROM users WHERE id = ?", [
      user.id,
    ]);
    assert.equal(userRow.email_verified_at, null);
  });
});
