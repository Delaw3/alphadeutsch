// Real-MySQL coverage: rollback, fault injection and connection failures.
//
// Rollback tests use `when: "after"`: the injected statement really executes and
// then throws, so only a genuine transactional ROLLBACK can restore the rows.
import "./preload.cjs";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import net from "node:net";

import { TestAccountRegistry } from "./helpers/accounts.mjs";
import { loadIntegrationEnv, readDbConfig } from "./helpers/env.mjs";
import { FaultInjector, FaultPool } from "./helpers/faults.mjs";
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
const { AuthError } = require("../build/auth/auth-errors.js");
const { MySqlChallengeStore } = require("../build/auth/mysql-challenges.js");

let env;
let pool;
let registry;
let removeSignalCleanup = null;

before(async () => {
  env = loadIntegrationEnv();
  assertIntegrationEnvironment(env);
  await assertLoopbackHost(env.DB_HOST);
  pool = createIntegrationPool(readDbConfig(env));
  const target = await assertWritableLocalAlphaDeutschTarget(pool, env);
  assert.equal(target.writesAllowed, true);
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

function isStoreError(error) {
  return (
    error instanceof AuthError &&
    error.code === "store-error" &&
    error.status === 500 &&
    error.message === "Account service is unavailable."
  );
}

async function stateFor(userId) {
  const challenge = await queryOne(
    pool,
    "SELECT used_at FROM verification_challenges WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [userId],
  );
  const user = await queryOne(pool, "SELECT email_verified_at FROM users WHERE id = ?", [userId]);
  return { usedAt: challenge ? challenge.used_at : null, verifiedAt: user.email_verified_at };
}

async function issueFixture(user, code, now) {
  const store = new MySqlChallengeStore(pool);
  const result = await store.issue({
    challenge: buildChallenge({ userId: user.id, code, now }),
    cooldownMs: COOLDOWN_MS,
    now,
  });
  assert.equal(result.status, "created");
  return store;
}

/**
 * A loopback port that is closed right now: bind :0, read the assigned port and
 * release it. No hardcoded assumption about what is listening on the host.
 */
async function closedLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

describe("MySQL OTP rollback", () => {
  it("rolls back the used marker when the transaction fails after the update", async () => {
    const user = await registry.create({ label: "rollback-used" });
    const now = wholeSecond();
    const code = "314159";
    await issueFixture(user, code, now);

    // The UPDATE really runs, then the failure arrives: only a genuine ROLLBACK
    // can leave used_at NULL.
    const injector = new FaultInjector().failOn("UPDATE verification_challenges SET used_at", {
      when: "after",
    });
    const failingStore = new MySqlChallengeStore(new FaultPool(pool, injector));

    await assert.rejects(
      failingStore.consumeAndVerify({
        userId: user.id,
        purpose: "signup",
        codeHash: codeHashFor(code),
        maxAttempts: MAX_ATTEMPTS,
        now,
        verifyUser: async () => undefined,
      }),
      isStoreError,
    );

    const state = await stateFor(user.id);
    assert.equal(state.usedAt, null);
    assert.equal(state.verifiedAt, null);

    // The rolled-back row (and its lock) must still be usable afterwards.
    const retry = await new MySqlChallengeStore(pool).consumeAndVerify({
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor(code),
      maxAttempts: MAX_ATTEMPTS,
      now,
      verifyUser: async () => undefined,
    });
    assert.equal(retry.status, "consumed");
    const afterRetry = await stateFor(user.id);
    assert.notEqual(afterRetry.usedAt, null);
    assert.notEqual(afterRetry.verifiedAt, null);
  });

  it("rolls back the challenge when the user verification update fails", async () => {
    const user = await registry.create({ label: "rollback-user" });
    const now = wholeSecond();
    const code = "271828";
    await issueFixture(user, code, now);

    // The users UPDATE executes inside the transaction and then throws, so both
    // writes must be undone.
    const injector = new FaultInjector().failOn("UPDATE users SET email_verified_at", {
      when: "after",
    });
    const failingStore = new MySqlChallengeStore(new FaultPool(pool, injector));

    await assert.rejects(
      failingStore.consumeAndVerify({
        userId: user.id,
        purpose: "signup",
        codeHash: codeHashFor(code),
        maxAttempts: MAX_ATTEMPTS,
        now,
        verifyUser: async () => undefined,
      }),
      isStoreError,
    );

    const state = await stateFor(user.id);
    assert.equal(state.usedAt, null);
    assert.equal(state.verifiedAt, null);

    const retry = await new MySqlChallengeStore(pool).consumeAndVerify({
      userId: user.id,
      purpose: "signup",
      codeHash: codeHashFor(code),
      maxAttempts: MAX_ATTEMPTS,
      now,
      verifyUser: async () => undefined,
    });
    assert.equal(retry.status, "consumed");
  });
});

describe("MySQL OTP failure handling", () => {
  it("rolls back the supersede update when the new insert fails", async () => {
    const user = await registry.create({ label: "rollback-insert" });
    const t0 = wholeSecond();
    await issueFixture(user, "112233", t0);

    // The INSERT really executes and then throws, so the supersede UPDATE must be
    // rolled back and the inserted row must disappear.
    const injector = new FaultInjector().failOn("INSERT INTO verification_challenges", {
      when: "after",
    });
    const failingStore = new MySqlChallengeStore(new FaultPool(pool, injector));
    const later = t0 + COOLDOWN_MS + 1000;

    await assert.rejects(
      failingStore.issue({
        challenge: buildChallenge({ userId: user.id, code: "445566", now: later }),
        cooldownMs: COOLDOWN_MS,
        now: later,
      }),
      isStoreError,
    );

    const rows = await pool.query(
      "SELECT used_at FROM verification_challenges WHERE user_id = ? ORDER BY id",
      [user.id],
    );
    assert.equal(rows[0].length, 1, "the failed re-issue must not leave a new row");
    assert.equal(rows[0][0].used_at, null, "the supersede update must roll back");

    // The original challenge is still the only active row and is still usable.
    const retry = await new MySqlChallengeStore(pool).issue({
      challenge: buildChallenge({ userId: user.id, code: "778899", now: later }),
      cooldownMs: COOLDOWN_MS,
      now: later,
    });
    assert.equal(retry.status, "created");
  });

  it("maps pool-acquisition failures to a generic store error without logging", async () => {
    const user = await registry.create({ label: "acquire-failure" });
    const now = wholeSecond();
    const code = "606060";
    const failingPool = new FaultPool(pool);
    failingPool.failGetConnection = true;
    const store = new MySqlChallengeStore(failingPool);

    // perf.ts emits through console.log/warn/error, so all three are stubbed.
    const original = { log: console.log, warn: console.warn, error: console.error };
    const lines = [];
    const capture = (...args) => lines.push(args.join(" "));
    console.log = capture;
    console.warn = capture;
    console.error = capture;

    let thrown;
    try {
      await assert.rejects(
        store.issue({
          challenge: buildChallenge({ userId: user.id, code, now }),
          cooldownMs: COOLDOWN_MS,
          now,
        }),
        isStoreError,
      );
      await assert.rejects(
        store.consumeAndVerify({
          userId: user.id,
          purpose: "signup",
          codeHash: codeHashFor(code),
          maxAttempts: MAX_ATTEMPTS,
          now,
          verifyUser: async () => undefined,
        }),
        (error) => {
          thrown = error;
          return isStoreError(error);
        },
      );
    } finally {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    }

    assert.deepEqual(lines, [], "the store must not log during failures");

    // The public error carries no SQL, parameter value or driver detail.
    assert.equal(thrown.message, "Account service is unavailable.");
    for (const fragment of ["verification_challenges", "users", code, "INSERT", "SELECT"]) {
      assert.equal(thrown.message.includes(fragment), false, fragment);
    }
  });

  it("maps query failures to a generic store error", async () => {
    const user = await registry.create({ label: "query-failure" });
    const now = wholeSecond();
    await issueFixture(user, "707070", now);

    const readInjector = new FaultInjector().failOn("FROM verification_challenges");
    const readStore = new MySqlChallengeStore(new FaultPool(pool, readInjector));
    await assert.rejects(readStore.latestForUser(user.id, "signup"), isStoreError);

    const lockInjector = new FaultInjector().failOn("FROM users");
    const lockStore = new MySqlChallengeStore(new FaultPool(pool, lockInjector));
    await assert.rejects(
      lockStore.issue({
        challenge: buildChallenge({ userId: user.id, code: "808080", now }),
        cooldownMs: COOLDOWN_MS,
        now,
      }),
      isStoreError,
    );
  });

  it("fails closed against a closed local port", async () => {
    const user = await registry.create({ label: "closed-port" });
    const now = wholeSecond();
    const port = await closedLoopbackPort();
    assert.ok(port > 0, "a loopback port must be available to test a closed connection");

    const deadPool = createIntegrationPool({ ...readDbConfig(env), host: "127.0.0.1", port });

    try {
      const store = new MySqlChallengeStore(deadPool);
      await assert.rejects(
        store.issue({
          challenge: buildChallenge({ userId: user.id, code: "909090", now }),
          cooldownMs: COOLDOWN_MS,
          now,
        }),
        isStoreError,
      );
    } finally {
      await closePoolQuietly(deadPool);
    }
  });
});
