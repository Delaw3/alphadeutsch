import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { authErrorResponse, authStores } from "@/lib/auth/auth-routes";
import { readSessionCookie, validateSessionToken } from "@/lib/auth/sessions";
import { getPool } from "@/lib/db";
import { normalizeDob } from "@/lib/auth/auth-errors";

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function resolveToken(request: Request): string | null {
  return readBearerToken(request) ?? readSessionCookie(request.headers.get("cookie"));
}

/**
 * POST /api/me/link-student
 * Body: { reg_no, dob }
 * Links the authenticated account to a stud2022 record (verified by reg_no + dob).
 * Sets users.stud2022_id and users.role = 'student'. Never derives admin from stud2022.
 * Identity (reg_no) is resolved via the session user only.
 */
export async function POST(request: Request) {
  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      reg_no?: unknown;
      regNo?: unknown;
      dob?: unknown;
    } | null;

    const regNoRaw = body?.reg_no ?? body?.regNo;
    const regNo = typeof regNoRaw === "string" ? regNoRaw.trim() : "";
    const dob = normalizeDob(body?.dob);

    if (!regNo || !dob) {
      return NextResponse.json({ error: "Registration number and date of birth are required." }, { status: 422 });
    }

    const pool = getPool();

    // Read-only lookup of the legacy student record (safe column projection only).
    const [[student]] = await pool.query<(RowDataPacket & { id: number; reg_no: string; dob: string | Date; status: string })[]>(
      "SELECT id, reg_no, dob, status FROM stud2022 WHERE TRIM(reg_no) = ? LIMIT 1",
      [regNo],
    );

    if (!student) {
      return NextResponse.json({ error: "Could not verify your student details." }, { status: 422 });
    }
    if ((student.status ?? "").trim().toLowerCase() !== "active") {
      return NextResponse.json({ error: "Could not verify your student details." }, { status: 422 });
    }
    const studentDob = normalizeDob(student.dob);
    if (!studentDob || studentDob !== dob) {
      return NextResponse.json({ error: "Could not verify your student details." }, { status: 422 });
    }

    // Prevent two accounts claiming the same stud2022 row.
    const alreadyLinked = await authStores.users.findByStud2022Id(student.id);
    if (alreadyLinked && alreadyLinked.id !== valid.userId) {
      return NextResponse.json({ error: "This student record is already linked to another account." }, { status: 409 });
    }

    await pool.query(
      "UPDATE users SET stud2022_id = ?, role = 'student' WHERE id = ?",
      [student.id, valid.userId],
    );

    return NextResponse.json({ message: "Student verified and linked.", reg_no: student.reg_no }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
}