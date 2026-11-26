// Service-level integration: signup -> dev outbox -> verification, resend,
// and a mocked SMTP adapter.
//
// The challenge store comes from helpers/safe-store.mjs, which blocks the
// production global expired-row sweep; the pool's statement guard rejects any
// unscoped DELETE as a second, unavoidable barrier.
import "./preload.cjs";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { TestAccountRegistry, makeTestEmail } from "./helpers/accounts.mjs";
import { loadIntegrationEnv, readDbConfig } from "./helpers/env.mjs";
import {
  assertIntegrationEnvironment,
  assertLoopbackHost,
  assertWritableLocalAlphaDeutschTarget,
} from "./helpers/guard.mjs";
import {
  assertDevProvider,
  assertSmtpIsolated,
  createCapturedMailer,
  createMockSmtpAdapter,
} from "./helpers/mail.mjs";
import { closePoolQuietly, createIntegrationPool, queryOne } from "./helpers/pool.mjs";
import {
  SweepBlockedChallengeStore,
  createSweepBlockedChallengeStore,
} from "./helpers/safe-store.mjs";
import { installSignalCleanup } from "./helpers/shutdown.mjs";
import { codeHashFor } from "./helpers/time.mjs";

const require = createRequire(import.meta.url);
const { AuthService } = require("../build/auth/auth-service.js");
const { AuthError, GENERIC_SIGNUP_MESSAGE } = require("../build/auth/auth-errors.js");
const { MemorySessionStore } = require("../build/auth/sessions.js");
const { MySqlUserStore } = require("../build/auth/mysql-users.js");

const PASSWORD = "Str0ng!Pass99";

let env;
let pool;
let registry;
let removeSignalCleanup = null;
let ipSequence = 0;

function nextIp(label) {
  ipSequence += 1;
  return `it-${label}-${ipSequence}`;
}

function makeService() {
  const mail = createCapturedMailer();
  const service = new AuthService({
    users: new MySqlUserStore(pool),
    sessions: new MemorySessionStore(),
    challenges: createSweepBlockedChallengeStore(pool),
    mailer: mail.adapter,
    passwordCost: 4,
    requireEmailVerify: false,
  });
  return { service, mail };
}

/**
 * Runs a signup and reconciles the account row by e-mail afterwards.
 * `AuthService.signup` inserts the user before it can fail (code issue or
 * delivery), so the row has to be tracked even when the promise rejects.
 */
async function signupTracked(service, input) {
  try {
    return await service.signup(input);
  } finally {
    await registry.registerByEmail(input.email);
  }
}

before(async () => {
  env = loadIntegrationEnv();
  assertIntegrationEnvironment(env);
  assertDevProvider(env);
  assertSmtpIsolated();
  await assertLoopbackHost(env.DB_HOST);
  pool = createIntegrationPool(readDbConfig(env));
  const target = await assertWritableLocalAlphaDeutschTarget(pool, env);
  assert.equal(target.writesAllowed, true);
  assert.equal(target.peerCheck, "loopback");
  assert.equal(target.accountScope, "loopback");
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

function hasCode(code) {
  return (error) => error instanceof AuthError && error.code === code;
}

describe("service: signup, outbox and verification", () => {
  it("sends through the dev outbox, stores only the hash and verifies once", async () => {
    const email = makeTestEmail("service-signup");
    const { service, mail } = makeService();

    const signup = await signupTracked(service, {
      email,
      name: "OTP Integration",
      password: PASSWORD,
      clientIp: nextIp("signup"),
    });
    assert.ok(signup.userId);
    assert.ok(
      SweepBlockedChallengeStore.blockedSweeps > 0,
      "issuing a code must not reach the global expired-challenge sweep",
    );

    const delivery = mail.latestFor(email);
    assert.ok(delivery, "the dev outbox must capture the code");
    assert.equal(delivery.channel, "dev-outbox");
    assert.equal(delivery.purpose, "signup");
    assert.match(delivery.code, /^\d{6}$/);

    const challenge = await queryOne(
      pool,
      "SELECT code_hash, used_at FROM verification_challenges " +
        "WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [signup.userId],
    );
    assert.equal(challenge.code_hash, codeHashFor(delivery.code));
    assert.notEqual(challenge.code_hash, delivery.code);
    assert.equal(challenge.used_at, null);

    const beforeVerify = await queryOne(
      pool,
      "SELECT email_verified_at FROM users WHERE id = ?",
      [signup.userId],
    );
    assert.equal(beforeVerify.email_verified_at, null);

    const verified = await service.verifyEmail({
      email,
      code: delivery.code,
      clientIp: nextIp("verify"),
    });
    assert.equal(verified.userId, signup.userId);

    const afterVerify = await queryOne(
      pool,
      "SELECT email_verified_at FROM users WHERE id = ?",
      [signup.userId],
    );
    assert.notEqual(afterVerify.email_verified_at, null);
    const used = await queryOne(
      pool,
      "SELECT used_at FROM verification_challenges WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [signup.userId],
    );
    assert.notEqual(used.used_at, null);

    await assert.rejects(
      service.verifyEmail({ email, code: delivery.code, clientIp: nextIp("replay") }),
      hasCode("code-used"),
    );
  });
});

describe("service: resend cooldown", () => {
  it("blocks a second resend, then allows one after the cooldown window", async () => {
    const user = await registry.create({ label: "service-resend" });
    const { service, mail } = makeService();

    await service.resendCode({ email: user.email, clientIp: nextIp("resend-one") });
    assert.equal(mail.size, 1);
    const first = mail.latestFor(user.email);
    assert.ok(first);

    await assert.rejects(
      service.resendCode({ email: user.email, clientIp: nextIp("resend-two") }),
      hasCode("code-resend-cooldown"),
    );
    assert.equal(mail.size, 1);

    // Age only this test-owned row instead of sleeping for 60 seconds.
    await pool.query(
      "UPDATE verification_challenges " +
        "SET last_sent_at = FROM_UNIXTIME(UNIX_TIMESTAMP() - 61), " +
        "expires_at = FROM_UNIXTIME(UNIX_TIMESTAMP() + 540) " +
        "WHERE user_id = ? AND purpose = 'signup' AND used_at IS NULL",
      [user.id],
    );

    await service.resendCode({ email: user.email, clientIp: nextIp("resend-three") });
    assert.equal(mail.size, 2);

    const totals = await queryOne(
      pool,
      "SELECT COUNT(*) AS total, SUM(used_at IS NULL) AS active " +
        "FROM verification_challenges WHERE user_id = ? AND purpose = 'signup'",
      [user.id],
    );
    assert.equal(Number(totals.total), 2);
    assert.equal(Number(totals.active), 1);
  });

  it("is a silent no-op for an already verified account", async () => {
    const user = await registry.create({ label: "service-verified", verifiedAt: Date.now() });
    const { service, mail } = makeService();

    const result = await service.resendCode({
      email: user.email,
      clientIp: nextIp("resend-verified"),
    });
    assert.equal(result.message, GENERIC_SIGNUP_MESSAGE);
    assert.equal(mail.size, 0);

    const count = await queryOne(
      pool,
      "SELECT COUNT(*) AS total FROM verification_challenges WHERE user_id = ?",
      [user.id],
    );
    assert.equal(Number(count.total), 0);
  });

  it("returns the generic message for an unknown address without sending", async () => {
    const { service, mail } = makeService();
    const result = await service.resendCode({
      email: makeTestEmail("service-unknown"),
      clientIp: nextIp("resend-unknown"),
    });
    assert.equal(result.message, GENERIC_SIGNUP_MESSAGE);
    assert.equal(mail.size, 0);
  });
});

describe("service: five incorrect verification attempts", () => {
  it("maps the store's attempt cap to the generic public errors", async () => {
    const email = makeTestEmail("service-attempts");
    const { service, mail } = makeService();
    const signup = await signupTracked(service, {
      email,
      name: "OTP Attempts",
      password: PASSWORD,
      clientIp: nextIp("signup-attempts"),
    });
    const delivery = mail.latestFor(email);
    assert.ok(delivery);

    const wrongCode = delivery.code === "000000" ? "000001" : "000000";
    const verifyIp = nextIp("verify-attempts");
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await assert.rejects(
        service.verifyEmail({ email, code: wrongCode, clientIp: verifyIp }),
        hasCode("code-invalid"),
      );
    }
    await assert.rejects(
      service.verifyEmail({ email, code: wrongCode, clientIp: verifyIp }),
      hasCode("code-attempts-exceeded"),
    );
    await assert.rejects(
      service.verifyEmail({ email, code: delivery.code, clientIp: verifyIp }),
      hasCode("code-attempts-exceeded"),
    );

    const user = await queryOne(pool, "SELECT email_verified_at FROM users WHERE id = ?", [
      signup.userId,
    ]);
    assert.equal(user.email_verified_at, null);
  });
});

describe("service: mocked SMTP delivery", () => {
  it("uses an injected transport and never opens a socket", async () => {
    const { adapter, transport } = createMockSmtpAdapter();
    const to = makeTestEmail("smtp-mock");

    const delivery = await adapter.sendVerificationCode({
      to,
      purpose: "signup",
      code: "042317",
    });

    assert.equal(delivery.channel, "smtp");
    assert.equal(delivery.to, to);
    assert.equal(transport.factories, 1);
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0].message.to, to);
    assert.match(transport.calls[0].message.subject, /verification/i);
  });
});
