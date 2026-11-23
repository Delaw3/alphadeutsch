import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { normalizeDob, normalizeEmail, validateNewPassword } from "@/lib/auth/auth-errors";
import { hashPassword } from "@/lib/auth/passwords";
import { MemoryRateLimiter } from "@/lib/auth/rate-limit";
import { getPool } from "@/lib/db";
import { logUnexpectedError, withApiTiming } from "@/lib/monitoring/perf";

const limiter = new MemoryRateLimiter(8, 10 * 60_000);

/**
 * POST /api/auth/student-setup
 * Body: { email, reg_no, dob, password }
 *
 * "Already a student" flow: verify the student by EMAIL + reg_no + DOB, then
 * set a NEW mobile password (bcrypt). The legacy `killer` column is untouched.
 */
export const POST = withApiTiming("POST /api/auth/student-setup", async (request: Request) => {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!limiter.check(`student-setup:${ip}`).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      reg_no?: unknown;
      regNo?: unknown;
      dob?: unknown;
      password?: unknown;
    } | null;

    const email = normalizeEmail(body?.email);
    const regRaw = body?.reg_no ?? body?.regNo;
    const regNo = typeof regRaw === "string" ? regRaw.trim() : "";
    const dob = normalizeDob(body?.dob);
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !regNo || !dob || !password) {
      return NextResponse.json(
        { error: "Email, registration number, date of birth, and a new password are required." },
        { status: 422 },
      );
    }

    const pw = validateNewPassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.reason ?? "Password does not meet requirements." }, { status: 422 });
    }

    const pool = getPool();

    const [[student]] = await pool.query<
      (RowDataPacket & {
        id: number;
        reg_no: string;
        fullname: string | null;
        email: string | null;
        dob: string | Date;
        status: string;
      })[]
    >(
      "SELECT id, reg_no, fullname, email, dob, status FROM stud2022 WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [email],
    );

    if (!student) {
      return NextResponse.json({ error: "No student found with this email address." }, { status: 422 });
    }
    if ((student.status ?? "").trim().toLowerCase() !== "active") {
      return NextResponse.json({ error: "This student record is not active. Please contact Alpha Deutsch." }, { status: 422 });
    }
    if ((student.reg_no ?? "").trim().toLowerCase() !== regNo.toLowerCase()) {
      return NextResponse.json({ error: "Registration number does not match this email." }, { status: 422 });
    }
    const studentDob = normalizeDob(student.dob);
    if (!studentDob || studentDob !== dob) {
      return NextResponse.json({ error: "Date of birth does not match this student record." }, { status: 422 });
    }

    const passwordHash = await hashPassword(password);

    const [existingRows] = await pool.query<(RowDataPacket & { id: number; stud2022_id: number | null })[]>(
      "SELECT id, stud2022_id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    const existing = existingRows[0];

    if (existing) {
      if (existing.stud2022_id && existing.stud2022_id !== student.id) {
        return NextResponse.json(
          { error: "This student record is already linked to another account." },
          { status: 409 },
        );
      }
      await pool.query(
        "UPDATE users SET password_hash = ?, stud2022_id = ?, role = 'student', failed_logins = 0, locked_until = NULL, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?",
        [passwordHash, student.id, existing.id],
      );
    } else {
      try {
        await pool.query(
          "INSERT INTO users (email, name, role, password_hash, stud2022_id, email_verified_at) VALUES (?, ?, 'student', ?, ?, NOW())",
          [email, student.fullname ?? null, passwordHash, student.id],
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "ER_DUP_ENTRY") throw error;
        await pool.query(
          "UPDATE users SET password_hash = ?, stud2022_id = ?, role = 'student', email_verified_at = COALESCE(email_verified_at, NOW()) WHERE email = ?",
          [passwordHash, student.id, email],
        );
      }
    }

    return NextResponse.json(
      { message: "Mobile login created. Sign in with your email and new password.", email },
      { status: 200 },
    );
  } catch (error) {
    logUnexpectedError(error);
    return NextResponse.json(
      { error: "Could not set up your mobile login. Please try again." },
      { status: 500 },
    );
  }
});
