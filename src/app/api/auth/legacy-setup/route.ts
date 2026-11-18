import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { normalizeDob, normalizeEmail } from "@/lib/auth/auth-errors";
import { hashPassword } from "@/lib/auth/passwords";
import { MemoryRateLimiter } from "@/lib/auth/rate-limit";
import { getPool } from "@/lib/db";

const limiter = new MemoryRateLimiter(5, 10 * 60_000);

function md5Hex(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * POST /api/auth/legacy-setup
 * Body: { reg_no, dob, password }
 *
 * Lets an existing (PHP website) student adopt their account on mobile:
 * - Verifies reg_no + DOB against `stud2022`
 * - Verifies `password` against the legacy MD5 hash in `stud2022.killer`
 * - Creates/updates the app `users` row with a BCRYPT `password_hash` and links
 *   it to the stud2022 record.
 * The legacy `killer` column is READ ONLY here and is never modified.
 */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!limiter.check(`legacy:${ip}`).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = (await request.json().catch(() => null)) as {
      reg_no?: unknown;
      regNo?: unknown;
      dob?: unknown;
      password?: unknown;
    } | null;

    const regRaw = body?.reg_no ?? body?.regNo;
    const regNo = typeof regRaw === "string" ? regRaw.trim() : "";
    const dob = normalizeDob(body?.dob);
    const password = typeof body?.password === "string" ? body.password : "";

    if (!regNo || !dob || !password) {
      return NextResponse.json(
        { error: "Registration number, date of birth, and your existing password are required." },
        { status: 422 },
      );
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
        killer: string | null;
      })[]
    >(
      "SELECT id, reg_no, fullname, email, dob, status, killer FROM stud2022 WHERE TRIM(reg_no) = ? LIMIT 1",
      [regNo],
    );

    if (!student) {
      return NextResponse.json({ error: `No student found with registration number "${regNo}".` }, { status: 422 });
    }
    if ((student.status ?? "").trim().toLowerCase() !== "active") {
      return NextResponse.json({ error: "This student record is not active. Please contact Alpha Deutsch." }, { status: 422 });
    }
    const studentDob = normalizeDob(student.dob);
    if (!studentDob || studentDob !== dob) {
      return NextResponse.json({ error: "Date of birth does not match this registration number." }, { status: 422 });
    }

    const killer = (student.killer ?? "").trim().toLowerCase();
    if (!killer) {
      return NextResponse.json(
        { error: "This student record has no existing website password. Please contact Alpha Deutsch." },
        { status: 422 },
      );
    }
    if (!safeEqualHex(md5Hex(password), killer)) {
      return NextResponse.json({ error: "Incorrect existing password." }, { status: 401 });
    }

    const email = normalizeEmail(student.email);
    if (!email) {
      return NextResponse.json(
        { error: "This student record has no valid email address. Please contact Alpha Deutsch." },
        { status: 422 },
      );
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
        "UPDATE users SET password_hash = ?, stud2022_id = ?, role = 'student', failed_logins = 0, locked_until = NULL WHERE id = ?",
        [passwordHash, student.id, existing.id],
      );
    } else {
      try {
        await pool.query(
          "INSERT INTO users (email, name, role, password_hash, stud2022_id) VALUES (?, ?, 'student', ?, ?)",
          [email, student.fullname ?? null, passwordHash, student.id],
        );
      } catch (error) {
        // Race: account created between SELECT and INSERT -> update instead.
        const code = (error as { code?: string }).code;
        if (code !== "ER_DUP_ENTRY") throw error;
        await pool.query(
          "UPDATE users SET password_hash = ?, stud2022_id = ?, role = 'student' WHERE email = ?",
          [passwordHash, student.id, email],
        );
      }
    }

    return NextResponse.json(
      {
        message: "Mobile login set up. Sign in with your email and this password.",
        email,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not set up your mobile login. Please try again." },
      { status: 500 },
    );
  }
}
