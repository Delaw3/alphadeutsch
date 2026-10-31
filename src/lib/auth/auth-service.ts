import "server-only";

import {
  GENERIC_SIGNUP_MESSAGE,
  invalidCredentials,
  normalizeDob,
  normalizeEmail,
  validateDisplayName,
  validateNewPassword,
  AuthError,
} from "./auth-errors";
import type { MailAdapter } from "./dev-mailer";
import type { StudentStore } from "./mysql-students";
import { dummyPasswordCompare, hashPassword, verifyPassword } from "./passwords";
import { MemoryRateLimiter, RATE_LIMITS } from "./rate-limit";
import { createSession, revokeSession, type SessionStore } from "./sessions";
import { consumeChallenge, issueChallenge, type ChallengeStore } from "./verification";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60_000; // 15 minutes

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
};

export type SignupResult = { message: string; userId: number | null };

export class AuthService {
  deps: AuthServiceDeps;
  private signupLimiter: MemoryRateLimiter;
  private regNoLimiter: MemoryRateLimiter;
  private signinLimiter: MemoryRateLimiter;
  private verifyLimiter: MemoryRateLimiter;
  private resendLimiter: MemoryRateLimiter;

  constructor(deps: AuthServiceDeps) {
    this.deps = deps;
    const s = RATE_LIMITS.signup;
    const i = RATE_LIMITS.signin;
    const v = RATE_LIMITS.verify;
    const r = RATE_LIMITS.resend;
    this.signupLimiter = deps.signupLimiter ?? new MemoryRateLimiter(s.limit, s.windowMs);
    this.regNoLimiter = deps.regNoLimiter ?? new MemoryRateLimiter(s.limit, s.windowMs);
    this.signinLimiter = deps.signinLimiter ?? new MemoryRateLimiter(i.limit, i.windowMs);
    this.verifyLimiter = deps.verifyLimiter ?? new MemoryRateLimiter(v.limit, v.windowMs);
    this.resendLimiter = deps.resendLimiter ?? new MemoryRateLimiter(r.limit, r.windowMs);
  }

  /**
   * Signup order:
   * 1. Rate-limit (per IP and per reg_no)
   * 2. Validate input
   * 3. Check stud2022 (reg_no trimmed, dob normalised to YYYY-MM-DD, status Active, not already linked)
   * 4. Only then handle an existing email ("already registered, please sign in")
   * Mismatches return the same generic message.
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

    // 4. Create the account as a plain 'user' (no student link yet).
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
      const issued = await issueChallenge(this.deps.challenges, { userId: user.id, purpose: "signup" });
      await this.deps.mailer.sendVerificationCode({ to: user.email, purpose: "signup", code: issued.code });
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
    await consumeChallenge(this.deps.challenges, { userId: user.id, purpose: "signup", code: input.code });
    await this.deps.users.markEmailVerified(user.id, Date.now());
    return { userId: user.id };
  }

  async resendCode(input: { email: unknown; clientIp?: string }): Promise<{ message: string }> {
    const rate = this.resendLimiter.check(`resend:${input.clientIp ?? "unknown"}`);
    if (!rate.allowed) throw new AuthError("rate-limited", 429, "Too many attempts. Please try again later.");
    const email = normalizeEmail(input.email);
    if (!email) return { message: GENERIC_SIGNUP_MESSAGE };
    const user = await this.deps.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return { message: GENERIC_SIGNUP_MESSAGE };
    const issued = await issueChallenge(this.deps.challenges, { userId: user.id, purpose: "signup" });
    await this.deps.mailer.sendVerificationCode({ to: user.email, purpose: "signup", code: issued.code });
    return { message: GENERIC_SIGNUP_MESSAGE };
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
