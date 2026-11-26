import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./preload.cjs");

const {
  AuthService,
  MemoryUserStore,
} = require("../build/auth/auth-service.js");
const { MemorySessionStore, hashSessionToken } = require("../build/auth/sessions.js");
const { MemoryChallengeStore } = require("../build/auth/verification.js");
const { DevOutboxAdapter } = require("../build/auth/dev-mailer.js");
const { MemoryStudentStore } = require("../build/auth/mysql-students.js");
const { AuthError } = require("../build/auth/auth-errors.js");

const PASSWORD = "Str0ng!Pass99";
const NEW_PASSWORD = "N3w!Passw0rd#42";
const EMAIL = "reset@example.com";

function makeService() {
  const mailer = new DevOutboxAdapter();
  const users = new MemoryUserStore();
  const sessions = new MemorySessionStore();
  const service = new AuthService({
    users,
    sessions,
    challenges: new MemoryChallengeStore(),
    mailer,
    students: new MemoryStudentStore(),
    passwordCost: 4,
  });
  return { service, users, sessions, mailer };
}

/** Signs up and verifies the e-mail so the account is eligible for a reset. */
async function verifiedAccount(service, mailer, email = EMAIL) {
  await service.signup({ email, name: "Test Student", password: PASSWORD, clientIp: `signup-${email}` });
  const code = mailer.latestFor(email)?.code;
  assert.ok(code, "signup must deliver a verification code");
  await service.verifyEmail({ email, code, clientIp: `verify-${email}` });
}

const isAuthError = (code) => (error) => error instanceof AuthError && error.code === code;

/** Session store whose bulk revocation fails on demand. */
class FailingRevokeSessionStore extends MemorySessionStore {
  constructor() {
    super();
    this.failRevoke = true;
  }

  async revokeAllForUser(userId) {
    if (this.failRevoke) throw new Error("simulated session store failure");
    return super.revokeAllForUser(userId);
  }
}

describe("password reset", () => {
  it("walks e-mail -> code -> ticket -> new password", async () => {
    const { service, sessions, mailer } = makeService();
    await verifiedAccount(service, mailer);

    const requested = await service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-1" });
    assert.match(requested.message, /sent a 6-digit code/i);

    const mail = mailer.latestFor(EMAIL);
    assert.equal(mail.purpose, "reset", "mail must be a reset code");

    const sessionBefore = await service.signin({ email: EMAIL, password: PASSWORD, clientIp: "signin-1" });

    const { ticket } = await service.verifyResetCode({
      email: EMAIL,
      code: mail.code,
      clientIp: "verify-reset-1",
    });
    assert.match(ticket, /^[0-9a-f]{64}$/, "ticket is a 256-bit hex string");

    await service.resetPassword({ email: EMAIL, ticket, password: NEW_PASSWORD, clientIp: "reset-1" });

    // Old password is dead, the new one signs in.
    await assert.rejects(
      () => service.signin({ email: EMAIL, password: PASSWORD, clientIp: "signin-2" }),
      isAuthError("invalid-credentials"),
    );
    const sessionAfter = await service.signin({ email: EMAIL, password: NEW_PASSWORD, clientIp: "signin-3" });
    assert.ok(sessionAfter.sessionToken);

    // Every session from before the reset is revoked.
    assert.equal(
      await sessions.findByTokenHash(hashSessionToken(sessionBefore.sessionToken)),
      null,
      "pre-reset sessions must be revoked",
    );

    // The ticket is single-use.
    await assert.rejects(
      () => service.resetPassword({ email: EMAIL, ticket, password: NEW_PASSWORD, clientIp: "reset-2" }),
      isAuthError("reset-token-invalid"),
    );
  });

  it("reports an unknown address and sends no mail", async () => {
    const { service, mailer } = makeService();
    await assert.rejects(
      () => service.requestPasswordReset({ email: "nobody@example.com", clientIp: "forgot-2" }),
      isAuthError("account-not-found"),
    );
    assert.equal(mailer.latestFor("nobody@example.com"), null);
  });

  it("refuses to send a code to an unverified account", async () => {
    const { service, users, mailer } = makeService();
    await users.create({ email: EMAIL, name: "Unverified", passwordHash: "x" });

    await assert.rejects(
      () => service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-3" }),
      isAuthError("email-not-verified"),
    );
    assert.equal(mailer.latestFor(EMAIL), null, "unverified accounts get no code");
  });

  it("rejects a wrong code and keeps the generic error", async () => {
    const { service, mailer } = makeService();
    await verifiedAccount(service, mailer);
    await service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-4" });

    await assert.rejects(
      () => service.verifyResetCode({ email: EMAIL, code: "000000", clientIp: "verify-reset-2" }),
      isAuthError("code-invalid"),
    );
  });

  it("rejects an unknown or expired ticket", async () => {
    const { service, users, mailer } = makeService();
    await verifiedAccount(service, mailer);
    await service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-5" });
    const code = mailer.latestFor(EMAIL).code;
    const { ticket } = await service.verifyResetCode({ email: EMAIL, code, clientIp: "verify-reset-3" });

    await assert.rejects(
      () =>
        service.resetPassword({
          email: EMAIL,
          ticket: "f".repeat(64),
          password: NEW_PASSWORD,
          clientIp: "reset-3",
        }),
      isAuthError("reset-token-invalid"),
    );

    // Force the stored ticket into the past.
    const user = await users.findByEmail(EMAIL);
    const hash = createHash("sha256").update(ticket, "utf8").digest("hex");
    await users.setResetTicket(user.id, hash, Date.now() - 1000);

    await assert.rejects(
      () => service.resetPassword({ email: EMAIL, ticket, password: NEW_PASSWORD, clientIp: "reset-4" }),
      isAuthError("reset-token-invalid"),
    );
  });

  it("applies the shared password policy", async () => {
    const { service, mailer } = makeService();
    await verifiedAccount(service, mailer);
    await service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-6" });
    const code = mailer.latestFor(EMAIL).code;
    const { ticket } = await service.verifyResetCode({ email: EMAIL, code, clientIp: "verify-reset-4" });

    await assert.rejects(
      () => service.resetPassword({ email: EMAIL, ticket, password: "short", clientIp: "reset-5" }),
      isAuthError("invalid-input"),
    );
  });

  it("rate-limits reset requests per IP", async () => {
    const { service, mailer } = makeService();
    await verifiedAccount(service, mailer);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-limit" });
    }
    await assert.rejects(
      () => service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-limit" }),
      isAuthError("rate-limited"),
    );
  });

  it("does not report success when session revocation fails", async () => {
    const { service, mailer } = makeService();
    const failing = new FailingRevokeSessionStore();
    service.deps.sessions = failing;

    await verifiedAccount(service, mailer);
    const sessionBefore = await service.signin({
      email: EMAIL,
      password: PASSWORD,
      clientIp: "signin-revoke-1",
    });

    await service.requestPasswordReset({ email: EMAIL, clientIp: "forgot-revoke-1" });
    const { code } = mailer.latestFor(EMAIL);
    const { ticket } = await service.verifyResetCode({
      email: EMAIL,
      code,
      clientIp: "verify-reset-revoke-1",
    });

    // The reset must fail loudly instead of claiming success while old sessions
    // stay usable.
    await assert.rejects(
      () =>
        service.resetPassword({
          email: EMAIL,
          ticket,
          password: NEW_PASSWORD,
          clientIp: "reset-revoke-1",
        }),
      /simulated session store failure/,
    );

    // Nothing was written: the old password still works and the ticket survives.
    const stillOld = await service.signin({
      email: EMAIL,
      password: PASSWORD,
      clientIp: "signin-revoke-2",
    });
    assert.ok(stillOld.sessionToken);

    // Once revocation works again the same ticket completes the reset.
    failing.failRevoke = false;
    await service.resetPassword({
      email: EMAIL,
      ticket,
      password: NEW_PASSWORD,
      clientIp: "reset-revoke-2",
    });

    await assert.rejects(
      () => service.signin({ email: EMAIL, password: PASSWORD, clientIp: "signin-revoke-3" }),
      isAuthError("invalid-credentials"),
    );
    assert.equal(
      await failing.findByTokenHash(hashSessionToken(sessionBefore.sessionToken)),
      null,
      "the session opened before the reset must be revoked",
    );
    assert.equal(
      await failing.findByTokenHash(hashSessionToken(stillOld.sessionToken)),
      null,
      "every session from before the reset must be revoked",
    );
  });
});
