import "server-only";

import { NextResponse } from "next/server";

import { AuthError } from "@/lib/auth/auth-errors";
import { DevOutboxAdapter, type MailAdapter } from "@/lib/auth/dev-mailer";
import { AuthService, MemoryUserStore, type UserStore } from "@/lib/auth/auth-service";
import { MemorySessionStore, type SessionStore } from "@/lib/auth/sessions";
import { MemoryChallengeStore, type ChallengeStore } from "@/lib/auth/verification";
import { MySqlUserStore } from "@/lib/auth/mysql-users";
import { MySqlSessionStore } from "@/lib/auth/mysql-sessions";
import { MySqlStudentStore, MemoryStudentStore, type StudentStore } from "@/lib/auth/mysql-students";
import { resolveAuthStoreKind, validateDbConfig, type AuthStoreKind } from "./auth-store-config";
import { getPool } from "@/lib/db";

export { resolveAuthStoreKind, validateDbConfig, type AuthStoreKind };

export type AuthStores = {
  users: UserStore;
  sessions: SessionStore;
  challenges: ChallengeStore;
  students: StudentStore;
  mailer: MailAdapter;
  kind: AuthStoreKind;
};

export function createAuthStores(): AuthStores {
  const kind = resolveAuthStoreKind();
  const mailer = new DevOutboxAdapter();
  const challenges = new MemoryChallengeStore();

  if (kind === "memory") {
    const users = new MemoryUserStore();
    const sessions = new MemorySessionStore();
    const students = new MemoryStudentStore();
    return { users, sessions, challenges, students, mailer, kind };
  }

  // MySQL store: validate DB configuration and create pooled adapters
  validateDbConfig();
  const pool = getPool();
  const users = new MySqlUserStore(pool);
  const sessions = new MySqlSessionStore(pool);
  const students = new MySqlStudentStore(pool);

  return { users, sessions, challenges, students, mailer, kind };
}

export const authStores = createAuthStores();

// Email verification is controlled by AUTH_REQUIRE_EMAIL_VERIFY (default false)
const requireEmailVerify = process.env.AUTH_REQUIRE_EMAIL_VERIFY?.trim().toLowerCase() === "true";

export const authService = new AuthService({
  users: authStores.users,
  sessions: authStores.sessions,
  challenges: authStores.challenges,
  students: authStores.students,
  mailer: authStores.mailer,
  requireEmailVerify,
  passwordCost: process.env.NODE_ENV === "test" ? 4 : undefined,
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "Account service is unavailable." }, { status: 500 });
}

export { clientIp };
