import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../auth/preload.cjs");
const {
  DevOutboxAdapter,
  FailingMailAdapter,
  assertDevDeliveryAllowed,
} = require("../build/auth/dev-mailer.js");
const { AuthService, MemoryUserStore } = require("../build/auth/auth-service.js");
const { MemoryStudentStore } = require("../build/auth/mysql-students.js");
const { MemorySessionStore } = require("../build/auth/sessions.js");
const { MemoryChallengeStore } = require("../build/auth/verification.js");
const { AuthError, GENERIC_SIGNUP_MESSAGE } = require("../build/auth/auth-errors.js");

class FailingMarkUserStore extends MemoryUserStore {
  constructor() {
    super();
    this.failMark = false;
  }

  async markEmailVerified(id, at) {
    if (this.failMark) {
      throw new AuthError("store-error", 500, "Account service is unavailable.");
    }
    return super.markEmailVerified(id, at);
  }
}

class FailOnceChallengeStore extends MemoryChallengeStore {
  constructor() {
    super();
    this.failNextIssue = true;
  }

  async issue(input) {
    if (this.failNextIssue) {
      this.failNextIssue = false;
      throw new AuthError("store-error", 500, "Account service is unavailable.");
    }
    return super.issue(input);
  }
}

class PausingMarkUserStore extends MemoryUserStore {
  constructor() {
    super();
    this.markStarted = null;
    this.releaseMark = null;
  }

  async markEmailVerified(id, at) {
    this.markStarted?.();
    await new Promise((resolve) => {
      this.releaseMark = resolve;
    });
    return super.markEmailVerified(id, at);
  }
}

function makeService(mailer, studentsList, options = {}) {
  const users = new MemoryUserStore();
  const students = new MemoryStudentStore(
    studentsList ?? [
      { id: 101, reg_no: "AD/2022/001", dob: "2000-01-15", status: "Active", name: "Alpha Student" },
      { id: 102, reg_no: "AD/2022/002", dob: "1999-05-20", status: "Active", name: "Beta Student" },
      { id: 103, reg_no: "AD/2022/003", dob: "2001-11-30", status: "Inactive", name: "Inactive Student" },
    ]
  );
  const service = new AuthService({
    users,
    students,
    sessions: new MemorySessionStore(),
    challenges: new MemoryChallengeStore(),
    mailer: mailer ?? new DevOutboxAdapter(),
    passwordCost: 4,
    requireEmailVerify: options.requireEmailVerify ?? false,
    maxFailedLogins: options.maxFailedLogins,
    lockoutDurationMs: options.lockoutDurationMs,
  });
  return { users, students, service, mailer: service.deps.mailer };
}

describe("signup + verify + signin", () => {
  it("creates account and signs in directly when requireEmailVerify=false (default)", async () => {
    const mailer = new DevOutboxAdapter();
    const { service, users } = makeService(mailer, null, { requireEmailVerify: false });
    const signup = await service.signup({
      email: "new.student@example.com",
      name: "New Student",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
    });
    assert.equal(signup.message, GENERIC_SIGNUP_MESSAGE);

    // New accounts are general users first; student link happens later.
    const created = await users.findByEmail("new.student@example.com");
    assert.equal(created?.role, "user");
    assert.equal(created?.stud2022Id ?? null, null);

    // With requireEmailVerify=false (default), user can sign in without email verification
    const session = await service.signin({ email: "new.student@example.com", password: "Str0ng!Pass99" });
    assert.equal(session.role, "user");
    assert.ok(session.userId);
    assert.ok(session.sessionToken.length >= 64);
  });

  it("requires email verification when requireEmailVerify=true", async () => {
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer, null, { requireEmailVerify: true });
    await service.signup({
      email: "verify.req@example.com",
      name: "Verify Required",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
    });
    const sent = mailer.latestFor("verify.req@example.com");

    // Signin blocked before verification
    await assert.rejects(
      service.signin({ email: "verify.req@example.com", password: "Str0ng!Pass99" }),
      (e) => e instanceof AuthError && e.code === "email-not-verified",
    );

    // Verify code
    await service.verifyEmail({ email: "verify.req@example.com", code: sent.code });

    // Now signin succeeds
    const session = await service.signin({ email: "verify.req@example.com", password: "Str0ng!Pass99" });
    assert.ok(session.sessionToken);
  });

  it("enforces account lockout after 5 failed password attempts", async () => {
    const { service, users } = makeService();
    await service.signup({
      email: "lockout@example.com",
      name: "Lockout",
      password: "Str0ng!Pass99",
    });

    // 4 failed attempts: returns invalid credentials
    for (let i = 0; i < 4; i++) {
      await assert.rejects(
        service.signin({ email: "lockout@example.com", password: "WrongPassword!1", clientIp: `ip-lockout-${i}` }),
        (e) => e instanceof AuthError && e.code === "invalid-credentials",
      );
    }

    const userBeforeLock = await users.findByEmail("lockout@example.com");
    assert.equal(userBeforeLock.failedLogins, 4);
    assert.equal(userBeforeLock.lockedUntil, null);

    // 5th failed attempt: triggers lockout
    await assert.rejects(
      service.signin({ email: "lockout@example.com", password: "WrongPassword!1", clientIp: "ip-lockout-5" }),
      (e) => e instanceof AuthError && e.code === "invalid-credentials",
    );

    const userLocked = await users.findByEmail("lockout@example.com");
    assert.equal(userLocked.failedLogins, 5);
    assert.ok(userLocked.lockedUntil && userLocked.lockedUntil > Date.now());

    // Next attempt even with correct password is rejected with account-locked
    await assert.rejects(
      service.signin({ email: "lockout@example.com", password: "Str0ng!Pass99", clientIp: "ip-lockout-6" }),
      (e) =>
        e instanceof AuthError &&
        e.code === "account-locked" &&
        e.status === 423 &&
        e.message === "Too many attempts, try again later",
    );

    // After resetting or expiry, successful login resets failed_logins and locked_until
    await users.resetFailedLogins(userLocked.id);
    const session = await service.signin({ email: "lockout@example.com", password: "Str0ng!Pass99", clientIp: "ip-lockout-7" });
    assert.ok(session.sessionToken);

    const userAfterReset = await users.findByEmail("lockout@example.com");
    assert.equal(userAfterReset.failedLogins, 0);
    assert.equal(userAfterReset.lockedUntil, null);
  });

  it("handles signup order: rate-limit -> validate -> check stud2022 -> check existing email", async () => {
    const { service } = makeService();

    // 1. Validation failure: missing reg_no or invalid dob returns generic message
    const res1 = await service.signup({
      email: "user1@example.com",
      password: "Str0ng!Pass99",
      reg_no: "",
      dob: "2000-01-15",
      clientIp: "ip-order-1",
    });
    assert.equal(res1.message, GENERIC_SIGNUP_MESSAGE);

    const res2 = await service.signup({
      email: "user2@example.com",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "not-a-date",
      clientIp: "ip-order-2",
    });
    assert.equal(res2.message, GENERIC_SIGNUP_MESSAGE);

    // 2. stud2022 check mismatches return same generic message
    const res3 = await service.signup({
      email: "user3@example.com",
      password: "Str0ng!Pass99",
      reg_no: "UNKNOWN/999",
      dob: "2000-01-15",
      clientIp: "ip-order-3",
    });
    assert.equal(res3.message, GENERIC_SIGNUP_MESSAGE);

    const res4 = await service.signup({
      email: "user4@example.com",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "1980-01-01",
      clientIp: "ip-order-4",
    });
    assert.equal(res4.message, GENERIC_SIGNUP_MESSAGE);

    const res5 = await service.signup({
      email: "user5@example.com",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/003", // Inactive
      dob: "2001-11-30",
      clientIp: "ip-order-5",
    });
    assert.equal(res5.message, GENERIC_SIGNUP_MESSAGE);

    // 3. Successful first registration links stud2022_id
    const res6 = await service.signup({
      email: "first@example.com",
      name: "First Student",
      password: "Str0ng!Pass99",
      reg_no: "  AD/2022/001  ",
      dob: "15/01/2000",
      clientIp: "ip-order-6",
    });
    assert.equal(res6.message, GENERIC_SIGNUP_MESSAGE);
    assert.ok(res6.userId);

    // 4. Already linked stud2022 returns generic message
    const res7 = await service.signup({
      email: "second@example.com",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
      clientIp: "ip-order-7",
    });
    assert.equal(res7.message, GENERIC_SIGNUP_MESSAGE);

    // 5. Existing email check: ONLY after stud2022 matches, existing email returns "already registered, please sign in"
    const res8 = await service.signup({
      email: "first@example.com",
      name: "First Student",
      password: "Str0ng!Pass99",
      clientIp: "ip-order-8",
    });
    assert.equal(res8.message, "already registered, please sign in");

    // But if stud2022 does not match, it returns the generic message even if email exists
    const res9 = await service.signup({
      email: "first@example.com",
      password: "Str0ng!Pass99",
      reg_no: "WRONG/REG",
      dob: "1999-05-20",
      clientIp: "ip-order-9",
    });
    assert.equal(res9.message, GENERIC_SIGNUP_MESSAGE);
  });

  it("enforces rate-limit per IP and per reg_no", async () => {
    const { service } = makeService();

    for (let i = 0; i < 5; i++) {
      await service.signup({
        email: `ratetest${i}@example.com`,
        password: "Str0ng!Pass99",
        reg_no: `REG/IP/${i}`,
        dob: "2000-01-01",
        clientIp: "192.168.1.100",
      });
    }

    await assert.rejects(
      service.signup({
        email: "ratetest_exceeded@example.com",
        password: "Str0ng!Pass99",
        reg_no: "REG/IP/999",
        dob: "2000-01-01",
        clientIp: "192.168.1.100",
      }),
      (e) => e instanceof AuthError && e.code === "rate-limited" && e.status === 429,
    );

    // Rate limiting is per IP only in the new model.
  });

  it("verification code is single-use (replay prevented)", async () => {
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    await service.signup({
      email: "replay@example.com",
      name: "Replay",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
    });
    const code = mailer.latestFor("replay@example.com").code;
    await service.verifyEmail({ email: "replay@example.com", code });
    await assert.rejects(
      service.verifyEmail({ email: "replay@example.com", code }),
      (e) => e instanceof AuthError && e.code === "code-used",
    );
  });

  it("expired codes fail and cleanup removes them", async () => {
    const { service } = makeService(new DevOutboxAdapter());
    const challenges = service.deps.challenges;
    await service.signup({
      email: "exp@example.com",
      name: "Exp",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
    });
    const row = await challenges.latestForUser(1, "signup");
    row.expiresAt = Date.now() - 1000;
    await challenges.saveForTest(row);
    await assert.rejects(
      service.verifyEmail({ email: "exp@example.com", code: "000000" }),
      (e) => e instanceof AuthError && e.code === "code-expired",
    );
    const removed = await challenges.deleteExpired(Date.now());
    assert.equal(removed, 1);
  });

  it("wrong-code attempts lock out after 5", async () => {
    const { service } = makeService(new DevOutboxAdapter());
    await service.signup({
      email: "lock@example.com",
      name: "Lock",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
    });
    for (let i = 0; i < 4; i += 1) {
      await assert.rejects(
        service.verifyEmail({ email: "lock@example.com", code: "000000" }),
        (e) => e instanceof AuthError && e.code === "code-invalid"
      );
    }
    await assert.rejects(
      service.verifyEmail({ email: "lock@example.com", code: "000000" }),
      (e) => e instanceof AuthError && e.code === "code-attempts-exceeded"
    );
  });

  it("resend cooldown enforced (60s)", async () => {
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    await service.signup({
      email: "cool@example.com",
      name: "Cool",
      password: "Str0ng!Pass99",
      reg_no: "AD/2022/001",
      dob: "2000-01-15",
    });
    await assert.rejects(
      service.resendCode({ email: "cool@example.com" }),
      (e) => e instanceof AuthError && e.code === "code-resend-cooldown"
    );
  });

  it("surfacing store and provider failures without secrets", async () => {
    const { service } = makeService();
    service.deps.users.failOnWrite = true;
    await assert.rejects(
      service.signup({
        email: "db@example.com",
        name: "Db",
        password: "Str0ng!Pass99",
        reg_no: "AD/2022/001",
        dob: "2000-01-15",
      }),
      (e) => e instanceof AuthError && e.code === "store-error"
    );
  });

  it("dev delivery blocked in production config", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.throws(() => assertDevDeliveryAllowed(), (e) => e instanceof AuthError && e.code === "provider-error");
      const mailer = new DevOutboxAdapter();
      await assert.rejects(mailer.sendVerificationCode({ to: "x@example.com", purpose: "signup", code: "123456" }));
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe("atomic verification and signup recovery", () => {
  it("rolls back the challenge when markEmailVerified fails", async () => {
    const failingUsers = new FailingMarkUserStore();
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    service.deps.users = failingUsers;

    await service.signup({
      email: "atomic@example.com",
      name: "Atomic Student",
      password: "Str0ng!Pass99",
    });
    const user = await failingUsers.findByEmail("atomic@example.com");
    assert.ok(user);
    const code = mailer.latestFor("atomic@example.com").code;

    failingUsers.failMark = true;
    await assert.rejects(
      service.verifyEmail({ email: "atomic@example.com", code }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );

    const challenge = await service.deps.challenges.latestForUser(user.id, "signup");
    assert.equal(challenge.usedAt, null);
    assert.equal((await failingUsers.findByEmail("atomic@example.com")).emailVerifiedAt, null);

    failingUsers.failMark = false;
    await service.verifyEmail({ email: "atomic@example.com", code });
    assert.ok((await failingUsers.findByEmail("atomic@example.com")).emailVerifiedAt);

    await assert.rejects(
      service.verifyEmail({ email: "atomic@example.com", code }),
      (error) => error instanceof AuthError && error.code === "code-used",
    );
  });

  it("allows resend recovery after challenge creation fails", async () => {
    const store = new FailOnceChallengeStore();
    const { service } = makeService(new DevOutboxAdapter());
    service.deps.challenges = store;

    await assert.rejects(
      service.signup({
        email: "challenge-fail@example.com",
        name: "Challenge Failure",
        password: "Str0ng!Pass99",
      }),
      (error) => error instanceof AuthError && error.code === "store-error",
    );
    const user = await service.deps.users.findByEmail("challenge-fail@example.com");
    assert.ok(user);
    assert.equal(user.emailVerifiedAt, null);

    const recoveryMailer = new DevOutboxAdapter();
    service.deps.mailer = recoveryMailer;
    const result = await service.resendCode({ email: "challenge-fail@example.com" });

    assert.equal(result.message, GENERIC_SIGNUP_MESSAGE);
    assert.ok(recoveryMailer.latestFor("challenge-fail@example.com"));
    assert.equal((await service.deps.users.findByEmail("challenge-fail@example.com")).id, user.id);
  });

  it("allows resend recovery after signup mail delivery fails", async () => {
    const { service } = makeService(new FailingMailAdapter());
    await assert.rejects(
      service.signup({
        email: "recover@example.com",
        name: "Recovery Student",
        password: "Str0ng!Pass99",
      }),
      (error) => error instanceof AuthError && error.code === "provider-error",
    );

    const user = await service.deps.users.findByEmail("recover@example.com");
    assert.ok(user);
    assert.equal(user.emailVerifiedAt, null);

    const challenge = await service.deps.challenges.latestForUser(user.id, "signup");
    await service.deps.challenges.saveForTest({
      ...challenge,
      lastSentAt: Date.now() - 61_000,
    });

    const recoveryMailer = new DevOutboxAdapter();
    service.deps.mailer = recoveryMailer;
    const result = await service.resendCode({ email: "recover@example.com" });

    assert.equal(result.message, GENERIC_SIGNUP_MESSAGE);
    assert.ok(recoveryMailer.latestFor("recover@example.com"));
    assert.equal((await service.deps.users.findByEmail("recover@example.com")).id, user.id);
    assert.equal((await service.deps.users.findByEmail("recover@example.com")).emailVerifiedAt, null);
  });

  it("allows an existing unverified user to resend without creating another account", async () => {
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    await service.signup({
      email: "unverified@example.com",
      name: "Unverified Student",
      password: "Str0ng!Pass99",
    });
    const user = await service.deps.users.findByEmail("unverified@example.com");
    const challenge = await service.deps.challenges.latestForUser(user.id, "signup");
    await service.deps.challenges.saveForTest({
      ...challenge,
      lastSentAt: Date.now() - 61_000,
    });

    const result = await service.resendCode({ email: "unverified@example.com" });

    assert.equal(result.message, GENERIC_SIGNUP_MESSAGE);
    assert.equal(mailer.outbox.filter((entry) => entry.to === "unverified@example.com").length, 2);
    assert.equal((await service.deps.users.findByEmail("unverified@example.com")).id, user.id);
  });

  it("does not issue a signup code to an already verified user", async () => {
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    await service.signup({
      email: "verified@example.com",
      name: "Verified Student",
      password: "Str0ng!Pass99",
    });
    const delivered = mailer.latestFor("verified@example.com");
    await service.verifyEmail({ email: "verified@example.com", code: delivered.code });
    const deliveredBeforeResend = mailer.outbox.length;

    const result = await service.resendCode({ email: "verified@example.com" });

    assert.equal(result.message, GENERIC_SIGNUP_MESSAGE);
    assert.equal(mailer.outbox.length, deliveredBeforeResend);
    assert.ok((await service.deps.users.findByEmail("verified@example.com")).emailVerifiedAt);
  });

  it("keeps signup retry safe after a partial failure", async () => {
    const { service } = makeService(new FailingMailAdapter());
    await assert.rejects(
      service.signup({
        email: "retry@example.com",
        name: "Retry Student",
        password: "Str0ng!Pass99",
      }),
      (error) => error instanceof AuthError && error.code === "provider-error",
    );
    const firstUser = await service.deps.users.findByEmail("retry@example.com");
    assert.ok(firstUser);

    const retry = await service.signup({
      email: "retry@example.com",
      name: "Retry Student",
      password: "Str0ng!Pass99",
    });

    assert.equal(retry.message, "already registered, please sign in");
    const secondUser = await service.deps.users.findByEmail("retry@example.com");
    assert.equal(secondUser.id, firstUser.id);
    assert.equal(secondUser.emailVerifiedAt, null);
  });
});

describe("concurrent verification and malformed attempts", () => {
  it("does not issue a resend challenge after concurrent verification completes", async () => {
    const pausingUsers = new PausingMarkUserStore();
    let started;
    const verificationStarted = new Promise((resolve) => {
      started = resolve;
    });
    pausingUsers.markStarted = started;

    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    service.deps.users = pausingUsers;

    await service.signup({
      email: "race@example.com",
      name: "Race Student",
      password: "Str0ng!Pass99",
    });
    const code = mailer.latestFor("race@example.com").code;
    const sentBeforeRace = mailer.outbox.length;

    const verification = service.verifyEmail({ email: "race@example.com", code });
    await verificationStarted;
    const resend = service.resendCode({ email: "race@example.com", clientIp: "race-ip" });
    await new Promise((resolve) => setImmediate(resolve));
    pausingUsers.releaseMark();

    const [verified, resent] = await Promise.all([verification, resend]);

    assert.equal(verified.userId, 1);
    assert.equal(resent.message, GENERIC_SIGNUP_MESSAGE);
    assert.equal(mailer.outbox.length, sentBeforeRace);
    assert.ok((await pausingUsers.findByEmail("race@example.com")).emailVerifiedAt);
  });

  it("counts malformed submissions toward the five-attempt limit", async () => {
    const mailer = new DevOutboxAdapter();
    const { service } = makeService(mailer);
    await service.signup({
      email: "malformed@example.com",
      name: "Malformed Student",
      password: "Str0ng!Pass99",
    });
    const user = await service.deps.users.findByEmail("malformed@example.com");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await assert.rejects(
        service.verifyEmail({ email: "malformed@example.com", code: "abc" }),
        (error) => error instanceof AuthError && error.code === "code-invalid",
      );
    }
    await assert.rejects(
      service.verifyEmail({ email: "malformed@example.com", code: "abcd" }),
      (error) => error instanceof AuthError && error.code === "code-attempts-exceeded",
    );

    const challenge = await service.deps.challenges.latestForUser(user.id, "signup");
    assert.equal(challenge.attempts, 5);
    await assert.rejects(
      service.verifyEmail({
        email: "malformed@example.com",
        code: mailer.latestFor("malformed@example.com").code,
      }),
      (error) => error instanceof AuthError && error.code === "code-attempts-exceeded",
    );
  });
});
