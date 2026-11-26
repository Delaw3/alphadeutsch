// Real-MySQL coverage: atomic consumption + verification and concurrency.
//
// Concurrency is exercised across *two independent pools* (two "instances"), so
// the `users` row lock — not a single connection or event loop — is what has to
// serialise the operations.
import "./preload.cjs";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { TestAccountRegistry } from "./helpers/accounts.mjs";
import { loadIntegrationEnv, readDbConfig } from "./helpers/env.mjs";
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
  buildChallenge,
  codeHashFor,
  wholeSecond,
} from "./helpers/time.mjs";

const require = createRequire(import.meta.url);
const { MySqlChallengeStore } = require("../build/auth/mysql-challenges.js");

let env;
let pool;
let poolB;
let registry;
let removeSignalCleanup = null;

before(async () => {
  env = loadIntegrationEnv();
  assertIntegrationEnvironment(env);
  await assertLoopbackHost(env.DB_HOST);
  pool = createIntegrationPool(readDbConfig(env));
  poolB = createIntegrationPool(readDbConfig(env));

  const target = await assertWritableLocalAlphaDeutschTarget(pool, env);
  assert.equal(target.writesAllowed, true);
  // The second "instance" is verified independently: a tunnel or a mismatched
  // server UUID must be caught for every pool that will write.
  const targetB = await assertWritableLocalAlphaDeutschTarget(poolB, env);
  assert.equal(targetB.serverUuid, target.serverUuid);
  assert.equal(targetB.peerCheck, "loopback");
  assert.equal(targetB.accountScope, "loopback");

  registry = new TestAccountRegistry(pool);
  removeSignalCleanup = installSignalCleanup(async () => {
    if (registry) await registry.dispose();
    await closePoolQuietly(poolB);
    await closePoolQuietly(pool);
  });
});

after(async () => {
  if (removeSignalCleanup) removeSignalCleanup();
  try {
    if (registry) await registry.dispose();
  } finally {
    await closePoolQuietly(poolB);
    await closePoolQuietly(pool);
  }
});

async function consumeAndVerifyInput(userId, code, now) {
  return {
    userId,
    purpose: "signup",
    codeHash: codeHashFor(code),
    maxAttempts: MAX_ATTEMPTS,
    now,
    verifyUser: async () => undefined,
  };
}

async function verificationState(userId) {
  const challenge = await queryOne(
    pool,
    "SELECT used_at FROM verification_challenges WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [userId],
  );
  const user = await queryOne(pool, "SELECT email_verified_at FROM users WHERE id = ?", [userId]);
  return { usedAt: challenge ? challenge.used_at : null, verifiedAt: user.email_verified_at };
}

describe("MySQL OTP atomic consume + verify", () => {
  it("marks the challenge used and verifies the user, then rejects replay", async () => {
    const user = await registry.create({ label: "atomic" });
    const store = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    const code = "135790";
    const issued = await store.issue({
      challenge: buildChallenge({ userId: user.id, code, now }),
      cooldownMs: COOLDOWN_MS,
      now,
    });
    assert.equal(issued.status, "created");

    let callbackCalls = 0;
    const input = await consumeAndVerifyInput(user.id, code, now);
    input.verifyUser = async () => {
      callbackCalls += 1;
    };

    const result = await store.consumeAndVerify(input);
    assert.equal(result.status, "consumed");
    assert.equal(callbackCalls, 0, "MySQL performs the user update inside its transaction");

    const state = await verificationState(user.id);
    assert.notEqual(state.usedAt, null);
    assert.notEqual(state.verifiedAt, null);
    const verifiedAt = state.verifiedAt.getTime();

    const replay = await store.consumeAndVerify(input);
    assert.equal(replay.status, "used");
    const afterReplay = await verificationState(user.id);
    assert.equal(afterReplay.verifiedAt.getTime(), verifiedAt);
  });

  it("issuing a challenge alone never verifies the user", async () => {
    const user = await registry.create({ label: "atomic-issued-only" });
    const store = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    await store.issue({
      challenge: buildChallenge({ userId: user.id, code: "246810", now }),
      cooldownMs: COOLDOWN_MS,
      now,
    });

    const state = await verificationState(user.id);
    assert.equal(state.usedAt, null);
    assert.equal(state.verifiedAt, null);
  });
});

describe("MySQL OTP concurrency", () => {
  it("allows only one of two simultaneous verification attempts", async () => {
    const user = await registry.create({ label: "concurrent-verify" });
    const storeA = new MySqlChallengeStore(pool);
    const now = wholeSecond();
    const code = "975310";
    await storeA.issue({
      challenge: buildChallenge({ userId: user.id, code, now }),
      cooldownMs: COOLDOWN_MS,
      now,
    });
    const input = await consumeAndVerifyInput(user.id, code, now);
    const storeB = new MySqlChallengeStore(poolB);

    const results = await Promise.all([
      storeA.consumeAndVerify(input),
      storeB.consumeAndVerify(input),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["consumed", "used"]);

    const state = await verificationState(user.id);
    assert.notEqual(state.usedAt, null);
    assert.notEqual(state.verifiedAt, null);
  });

  it("serializes concurrent issuance so the cooldown cannot be bypassed", async () => {
    const user = await registry.create({ label: "concurrent-issue" });
    const storeA = new MySqlChallengeStore(pool);
    const storeB = new MySqlChallengeStore(poolB);
    const t0 = wholeSecond();

    const results = await Promise.all([
      storeA.issue({
        challenge: buildChallenge({ userId: user.id, code: "111111", now: t0 }),
        cooldownMs: COOLDOWN_MS,
        now: t0,
      }),
      storeB.issue({
        challenge: buildChallenge({ userId: user.id, code: "222222", now: t0 }),
        cooldownMs: COOLDOWN_MS,
        now: t0,
      }),
    ]);

    assert.deepEqual(results.map((result) => result.status).sort(), ["cooldown", "created"]);
    const created = results.find((result) => result.status === "created");
    const blocked = results.find((result) => result.status === "cooldown");
    assert.equal(blocked.challenge.id, created.challenge.id);

    const count = await queryOne(
      pool,
      "SELECT COUNT(*) AS total FROM verification_challenges WHERE user_id = ?",
      [user.id],
    );
    assert.equal(Number(count.total), 1);
  });

  it("increments concurrent wrong attempts exactly once each", async () => {
    const user = await registry.create({ label: "concurrent-attempts" });
    const storeA = new MySqlChallengeStore(pool);
    const storeB = new MySqlChallengeStore(poolB);
    const now = wholeSecond();
    await storeA.issue({
      challenge: buildChallenge({ userId: user.id, code: "555555", now }),
      cooldownMs: COOLDOWN_MS,
      now,
    });

    const wrong = {
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor("000000"),
      maxAttempts: MAX_ATTEMPTS,
      now,
    };
    const results = await Promise.all([storeA.consume(wrong), storeB.consume(wrong)]);
    assert.deepEqual(results.map((result) => result.status), ["invalid", "invalid"]);

    const row = await queryOne(
      pool,
      "SELECT attempts, used_at FROM verification_challenges WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [user.id],
    );
    assert.equal(Number(row.attempts), 2);
    assert.equal(row.used_at, null);
  });
});
