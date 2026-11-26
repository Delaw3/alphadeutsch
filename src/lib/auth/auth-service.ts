import { createHash, randomBytes } from "node:crypto";

import "server-only";

import {
  GENERIC_SIGNUP_MESSAGE,
  invalidCredentials,
  normalizeEmail,
  validateDisplayName,
  validateNewPassword,
  AuthError,
} from "./auth-errors";
import type { MailAdapter } from "./dev-mailer";
import type { StudentStore } from "./mysql-students";
import { digestsEqual, readCodePepper } from "./otp";
import { dummyPasswordCompare, hashPassword, verifyPassword } from "./passwords";
import { MemoryRateLimiter, RATE_LIMITS } from "./rate-limit";
import { createSession, revokeSession, type SessionStore } from "./sessions";
import { consumeChallenge, issueChallenge, type ChallengeStore } from "./verification";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60_000; // 15 minutes
/** How long the ticket from a verified reset code stays usable. */
export const RESET_TICKET_TTL_MS = 15 * 60_000;

export type AppUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string;
  emailVerifiedAt: number | null;
  failedLogins: number;
  lockedUntil: number | null;
  stud2022Id: number | null;
  createdAt: number;
  /** SHA-256 of the single-use password-reset ticket, null when none is active. */
  resetTokenHash: string | null;
  resetTokenExpiresAt: number | null;
};

export type UserStore = {
  findByEmail(email: string): Promise<AppUser | null>;
  findById(id: number): Promise<AppUser | null>;
  findByStud2022Id(stud2022Id: number): Promise<AppUser | null>;
  create(input: {
    email: string;
    name: string | null;
    passwordHash: string;
    stud2022Id?: number | null;
    role?: string;
  }): Promise<AppUser>;
  markEmailVerified(id: number, at: number): Promise<void>;
  recordFailedLogin(id: number, failedLogins: number, lockedUntil: number | null): Promise<void>;
  resetFailedLogins(id: number): Promise<void>;
  /** Stores (or clears, with `null`) the single-use reset ticket. */
  setResetTicket(id: number, tokenHash: string | null, expiresAt: number | null): Promise<void>;
  /** Replaces the password hash and clears the ticket and any lockout. */
  updatePassword(id: number, passwordHash: string): Promise<void>;
};

export class MemoryUserStore implements UserStore {
  private rows = new Map<number, AppUser>();
  private nextId = 1;
  failOnWrite = false;

  async findByEmail(email: string) {
    const lower = email.toLowerCase();
    for (const row of this.rows.values()) {
      if (row.email.toLowerCase() === lower) return { ...row };
    }
    return null;
  }

  async findById(id: number) {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async findByStud2022Id(stud2022Id: number): Promise<AppUser | null> {
    for (const row of this.rows.values()) {
      if (row.stud2022Id === stud2022Id) return { ...row };
    }
    return null;
  }

  async create(input: {
    email: string;
    name: string | null;
    passwordHash: string;
    stud2022Id?: number | null;
    role?: string;
  }) {
    if (this.failOnWrite) throw new AuthError("store-error", 500, "Account service is unavailable.");
    const now = Date.now();
    const user: AppUser = {
      id: this.nextId++,
      email: input.email,
      name: input.name,
      role: input.role ?? "user",
      passwordHash: input.passwordHash,
      emailVerifiedAt: null,
      failedLogins: 0,
      lockedUntil: null,
      stud2022Id: input.stud2022Id ?? null,
      createdAt: now,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    };
    this.rows.set(user.id, user);
    return { ...user };
  }

  async markEmailVerified(id: number, at: number) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, emailVerifiedAt: at });
  }

  async recordFailedLogin(id: number, failedLogins: number, lockedUntil: number | null) {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, failedLogins, lockedUntil });
    }
  }

  async resetFailedLogins(id: number) {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, failedLogins: 0, lockedUntil: null });
    }
  }

  async setResetTicket(id: number, tokenHash: string | null, expiresAt: number | null) {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt });
    }
  }

  async updatePassword(id: number, passwordHash: string) {
    const row = this.rows.get(id);
    if (!row) return;
    this.rows.set(id, {
      ...row,
      passwordHash,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      failedLogins: 0,
      lockedUntil: null,
    });
  }

  get size() {
    return this.rows.size;
  }
}

/** Legacy identity-linking boundary — stubbed until owner confirms rules. */
export type LegacyLinkResult = { linked: false; reason: string };

export class IdentityLinkService {
  async findLegacyStudent(): Promise<null> {
    return null;
  }

  async linkExistingStudent(): Promise<LegacyLinkResult> {
    return { linked: false, reason: "Legacy identity linking is disabled pending owner confirmation." };
  }
}

export type AuthServiceDeps = {
  users: UserStore;
  sessions: SessionStore;
  challenges: ChallengeStore;
  mailer: MailAdapter;
  students?: StudentStore;
  signupLimiter?: MemoryRateLimiter;
  regNoLimiter?: MemoryRateLimiter;
  signinLimiter?: MemoryRateLimiter;
  verifyLimiter?: MemoryRateLimiter;
  resendLimiter?: MemoryRateLimiter;
  passwordCost?: number;
  requireEmailVerify?: boolean;
  maxFailedLogins?: number;
  lockoutDurationMs?: number;
  forgotLimiter?: MemoryRateLimiter;
};

export type SignupResult = {
  message: string;
  userId: number | null;
  /**
   * Set when the address belongs to an active `stud2022` row and **no app
   * account exists yet**: the client continues to `/student-setup`. A student
   * who already completed setup gets "already registered, please sign in"
   * instead, so the setup form is never shown twice.
   */
  needsStudentSetup?: boolean;
  email?: string;
};

export class AuthService {
  deps: AuthServiceDeps;
  private signupLimiter: MemoryRateLimiter;
  private regNoLimiter: MemoryRateLimiter;
  private signinLimiter: MemoryRateLimiter;
  private verifyLimiter: MemoryRateLimiter;
  private resendLimiter: MemoryRateLimiter;
  private forgotLimiter: MemoryRateLimiter;

  constructor(deps: AuthServiceDeps) {
    this.deps = deps;
    const s = RATE_LIMITS.signup;
    const i = RATE_LIMITS.signin;
    const v = RATE_LIMITS.verify;
    const r = RATE_LIMITS.resend;
    const f = RATE_LIMITS.forgot;
    this.signupLimiter = deps.signupLimiter ?? new MemoryRateLimiter(s.limit, s.windowMs);
    this.regNoLimiter = deps.regNoLimiter ?? new MemoryRateLimiter(s.limit, s.windowMs);
    this.signinLimiter = deps.signinLimiter ?? new MemoryRateLimiter(i.limit, i.windowMs);
    this.verifyLimiter = deps.verifyLimiter ?? new MemoryRateLimiter(v.limit, v.windowMs);
    this.resendLimiter = deps.resendLimiter ?? new MemoryRateLimiter(r.limit, r.windowMs);
    this.forgotLimiter = deps.forgotLimiter ?? new MemoryRateLimiter(f.limit, f.windowMs);
  }

  /**
   * Signup order:
   * 1. Rate-limit (per IP)
   * 2. Validate input (name, e-mail, password)
   * 3. Existing app account -> "already registered, please sign in"
   * 4. Active `stud2022` row and no account yet -> `needsStudentSetup`
   * 5. Otherwise create a plain account and e-mail a verification code
   *
   * Step 3 comes before step 4 on purpose: a student who already finished the
   * mobile setup must not be sent back to `/student-setup`.
   */
  async signup(input: {
    email: unknown;
    name?: unknown;
    password: unknown;
    clientIp?: string;
  }): Promise<SignupResult> {
    // 1. Rate-limit (per IP)
    const rateIp = this.signupLimiter.check(`signup:ip:${input.clientIp ?? "unknown"}`);
    if (!rateIp.allowed) {
      throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");
    }

    // 2. Validate input. Anyone can sign up (name, email, password); no
    // stud2022 claim happens here — stud2022_id stays NULL.
    const email = normalizeEmail(input.email);
    const passwordCheck = validateNewPassword(input.password);
    const name = validateDisplayName(input.name);
    if (!email || !passwordCheck.ok || !name) {
      return { message: GENERIC_SIGNUP_MESSAGE, userId: null };
    }

    // 3. Handle an existing email ("already registered, please sign in")
    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      return { message: "already registered, please sign in", userId: null };
    }

    // 4. No app account yet: an active student row gets the "already a student"
    // setup flow. Because step 3 already returned for existing accounts, a
    // student who completed the mobile setup is never sent back to it.
    try {
      const student = this.deps.students ? await this.deps.students.findByEmail(email) : null;
      if (student) {
        return { message: GENERIC_SIGNUP_MESSAGE, userId: null, needsStudentSetup: true, email };
      }
    } catch {
      // A stud2022 outage must not block ordinary signups; the account can be
      // linked to the student record later from inside the app.
    }

    // Fail closed on OTP configuration before creating an account. This avoids
    // leaving an unverified account behind when the pepper is missing.
    readCodePepper();

    // 5. Create the account as a plain 'user' (no student link yet).
    const passwordHash = await hashPassword(input.password as string, this.deps.passwordCost);
    let user: AppUser;
    try {
      user = await this.deps.users.create({
        email,
        name,
        passwordHash,
        stud2022Id: null,
        role: "user",
      });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("store-error", 500, "Account service is unavailable.");
    }

    try {
      const issued = await issueChallenge(this.deps.challenges, {
        userId: user.id,
        purpose: "signup",
      });
      if (issued.status === "already-verified") {
        return { message: GENERIC_SIGNUP_MESSAGE, userId: user.id };
      }
      await this.deps.mailer.sendVerificationCode({
        to: user.email,
        purpose: "signup",
        code: issued.code,
        trigger: "signup",
      });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
    }

    return { message: GENERIC_SIGNUP_MESSAGE, userId: user.id };
  }

  async verifyEmail(input: { email: unknown; code: unknown; clientIp?: string }): Promise<{ userId: number }> {
    const rate = this.verifyLimiter.check(`verify:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");
    const email = normalizeEmail(input.email);
    if (!email || typeof input.code !== "string") {
      throw new AuthError("code-invalid", 400, "Invalid or expired verification code.");
    }
    const user = await this.deps.users.findByEmail(email);
    if (!user) throw new AuthError("code-invalid", 400, "Invalid or expired verification code.");
    await consumeChallenge(
      this.deps.challenges,
      { userId: user.id, purpose: "signup", code: input.code },
      () => this.deps.users.markEmailVerified(user.id, Date.now()),
    );
    return { userId: user.id };
  }

  async resendCode(input: { email: unknown; clientIp?: string }): Promise<{ message: string }> {
    const rate = this.resendLimiter.check(`resend:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");
    const email = normalizeEmail(input.email);
    if (!email) return { message: GENERIC_SIGNUP_MESSAGE };
    const user = await this.deps.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return { message: GENERIC_SIGNUP_MESSAGE };
    const issued = await issueChallenge(this.deps.challenges, {
      userId: user.id,
      purpose: "signup",
      isUserVerified: async () => {
        const current = await this.deps.users.findById(user.id);
        return Boolean(current?.emailVerifiedAt);
      },
    });
    if (issued.status === "already-verified") {
      return { message: GENERIC_SIGNUP_MESSAGE };
    }
    await this.deps.mailer.sendVerificationCode({
      to: user.email,
      purpose: "signup",
      code: issued.code,
      trigger: "resend",
    });
    return { message: GENERIC_SIGNUP_MESSAGE };
  }

  /**
   * Forgot-password step 1: verify the address and e-mail a reset code.
   *
   * The account must exist and its e-mail must be verified, otherwise the
   * caller gets an explicit error (`account-not-found` / `email-not-verified`)
   * and no code is sent. Signup already reveals account existence, so this does
   * not open a new enumeration channel.
   */
  async requestPasswordReset(input: { email: unknown; clientIp?: string }): Promise<{ message: string }> {
    const rate = this.forgotLimiter.check(`forgot:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");

    const email = normalizeEmail(input.email);
    if (!email) throw new AuthError("invalid-input", 400, "Enter a valid email address.");

    const user = await this.deps.users.findByEmail(email);
    if (!user) {
      throw new AuthError("account-not-found", 404, "No account was found with that email address.");
    }
    if (!user.emailVerifiedAt) {
      throw new AuthError(
        "email-not-verified",
        403,
        "This email is not verified yet. Verify it first, then reset your password.",
      );
    }

    let issued;
    try {
      issued = await issueChallenge(this.deps.challenges, { userId: user.id, purpose: "reset" });
    } catch (error) {
      // A code was sent moments ago: that code is still valid, so the flow can
      // continue instead of failing.
      if (error instanceof AuthError && error.code === "code-resend-cooldown") {
        return { message: "A code was sent recently. Use it, or wait a minute for a new one." };
      }
      throw error;
    }
    if (issued.status === "already-verified") {
      return { message: "A code was sent recently. Use it, or wait a minute for a new one." };
    }

    await this.deps.mailer.sendVerificationCode({
      to: user.email,
      purpose: "reset",
      code: issued.code,
      trigger: "resend",
    });
    return { message: `We sent a 6-digit code to ${user.email}.` };
  }

  /**
   * Forgot-password step 2: consumes the reset code and returns a single-use
   * ticket (only its SHA-256 is stored) that step 3 exchanges for a new password.
   */
  async verifyResetCode(input: { email: unknown; code: unknown; clientIp?: string }): Promise<{ ticket: string }> {
    const rate = this.verifyLimiter.check(`reset-verify:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");

    const email = normalizeEmail(input.email);
    if (!email || typeof input.code !== "string") {
      throw new AuthError("code-invalid", 400, "Invalid or expired verification code.");
    }

    const user = await this.deps.users.findByEmail(email);
    if (!user || !user.emailVerifiedAt) {
      throw new AuthError("code-invalid", 400, "Invalid or expired verification code.");
    }

    await consumeChallenge(this.deps.challenges, {
      userId: user.id,
      purpose: "reset",
      code: input.code,
    });

    const ticket = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(ticket, "utf8").digest("hex");
    await this.deps.users.setResetTicket(user.id, tokenHash, Date.now() + RESET_TICKET_TTL_MS);
    return { ticket };
  }

  /**
   * Forgot-password step 3: exchanges the ticket for a new password, clears any
   * lockout and revokes every existing session for the account.
   */
  async resetPassword(input: {
    email: unknown;
    ticket: unknown;
    password: unknown;
    clientIp?: string;
  }): Promise<{ reset: boolean }> {
    const rate = this.verifyLimiter.check(`reset-apply:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");

    const expired = () =>
      new AuthError("reset-token-invalid", 400, "This reset session has expired. Please start again.");

    const email = normalizeEmail(input.email);
    if (!email || typeof input.ticket !== "string" || input.ticket.length < 32) throw expired();

    const passwordCheck = validateNewPassword(input.password);
    if (!passwordCheck.ok) {
      throw new AuthError("invalid-input", 400, passwordCheck.reason ?? "Choose a stronger password.");
    }

    const user = await this.deps.users.findByEmail(email);
    if (!user || !user.emailVerifiedAt || !user.resetTokenHash || !user.resetTokenExpiresAt) throw expired();

    if (user.resetTokenExpiresAt <= Date.now()) {
      await this.deps.users.setResetTicket(user.id, null, null);
      throw expired();
    }

    const presented = createHash("sha256").update(input.ticket, "utf8").digest("hex");
    if (!digestsEqual(presented, user.resetTokenHash)) throw expired();

    const passwordHash = await hashPassword(input.password as string, this.deps.passwordCost);

    // Revoke every existing session BEFORE the password is written. Revoking
    // afterwards — and swallowing the error — could answer 200 while sessions
    // opened with the old password stayed valid, which is the opposite of what a
    // reset must guarantee. This order keeps failure outcomes consistent:
    // - revoke throws  -> nothing was written; the ticket is still valid, retry.
    // - write throws   -> the user is merely signed out; retry with the ticket.
    // The client sees an error instead of a false "password updated".
    await this.deps.sessions.revokeAllForUser(user.id);
    await this.deps.users.updatePassword(user.id, passwordHash);
    return { reset: true };
  }

  async signin(input: {
    email: unknown;
    password: unknown;
    clientIp?: string | null;
    userAgent?: string | null;
  }): Promise<{ userId: number; sessionToken: string; role: string }> {
    const rate = this.signinLimiter.check(`signin:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");
    const email = normalizeEmail(input.email);
    if (!email || typeof input.password !== "string" || input.password.length === 0) {
      await dummyPasswordCompare();
      throw invalidCredentials();
    }
    const user = await this.deps.users.findByEmail(email);
    if (!user) {
      await dummyPasswordCompare();
      throw invalidCredentials();
    }

    // Account lockout check (persisted in DB)
    const now = Date.now();
    if (user.lockedUntil !== null && user.lockedUntil > now) {
      await dummyPasswordCompare();
      throw new AuthError(
        "account-locked",
        423,
        "Too many attempts, try again later",
      );
    }

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      const maxFailures = this.deps.maxFailedLogins ?? MAX_FAILED_LOGINS;
      const lockoutMs = this.deps.lockoutDurationMs ?? LOCKOUT_DURATION_MS;
      const newFailed = user.failedLogins + 1;
      const willLock = newFailed >= maxFailures;
      const lockedUntil = willLock ? now + lockoutMs : null;
      await this.deps.users.recordFailedLogin(user.id, newFailed, lockedUntil);
      throw invalidCredentials();
    }

    // Reset failed logins on successful sign-in
    if (user.failedLogins > 0 || user.lockedUntil !== null) {
      await this.deps.users.resetFailedLogins(user.id);
    }

    // Optional email verification check (controlled by AUTH_REQUIRE_EMAIL_VERIFY, default false)
    if (this.deps.requireEmailVerify && !user.emailVerifiedAt) {
      throw new AuthError("email-not-verified", 403, "Verify your email before signing in.");
    }

    const created = await createSession(this.deps.sessions, {
      userId: user.id,
      requestIp: input.clientIp ?? null,
      userAgent: input.userAgent ?? null,
    });
    return { userId: user.id, sessionToken: created.token, role: user.role };
  }

  async signout(sessionToken: string | null | undefined): Promise<{ signedOut: boolean }> {
    const revoked = await revokeSession(this.deps.sessions, sessionToken);
    return { signedOut: revoked };
  }
}
