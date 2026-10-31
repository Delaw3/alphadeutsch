import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { authErrorResponse, authStores } from "@/lib/auth/auth-routes";
import { readSessionCookie, validateSessionToken } from "@/lib/auth/sessions";
import { getPool } from "@/lib/db";

/**
 * GET /api/me/results?course_id=&sitting=
 *
 * Returns the authenticated student's exam results for a given course and sitting.
 * Results are only returned when course_reg.payment_status = 'Yes'.
 * Never returns killer, reset_token, or password_hash.
 */

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function resolveToken(request: Request): string | null {
  return (
    readBearerToken(request) ??
    readSessionCookie(request.headers.get("cookie"))
  );
}

type ResultRow = RowDataPacket & {
  course_id: number;
  course_title: string;
  sitting: number;
  horen_score: number | null;
  horen_grade: string | null;
  lesen_score: number | null;
  lesen_grade: string | null;
  schreiben_score: number | null;
  schreiben_grade: string | null;
  sprechen_score: number | null;
  sprechen_grade: string | null;
  total_score: number | null;
  overall_grade: string | null;
};

export async function GET(request: Request) {
  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = Number(searchParams.get("course_id"));
    const sitting = Number(searchParams.get("sitting"));

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return NextResponse.json({ error: "Invalid course_id." }, { status: 422 });
    }
    if (!Number.isInteger(sitting) || sitting < 1 || sitting > 5) {
      return NextResponse.json({ error: "Invalid sitting (1–5)." }, { status: 422 });
    }

    const pool = getPool();

    // Resolve reg_no from the session link only (never from the client)
    const [[userRow]] = await pool.query<(RowDataPacket & { reg_no: string | null })[]>(
      "SELECT s.reg_no FROM users u " +
        "INNER JOIN stud2022 s ON u.stud2022_id = s.id " +
        "WHERE u.id = ? LIMIT 1",
      [valid.userId]
    );
    const reg_no = userRow?.reg_no?.trim();
    if (!reg_no) {
      return NextResponse.json({ data: null, reason: "no-student" });
    }

    // Check payment status first
    const [[payRow]] = await pool.query<(RowDataPacket & { payment_status: string })[]>(
      `SELECT payment_status FROM course_reg
       WHERE TRIM(student_reg_no) COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci
         AND course_id = ? LIMIT 1`,
      [reg_no, courseId]
    );
    if (!payRow) {
      return NextResponse.json({ data: null, reason: "not-registered" });
    }
    if (payRow.payment_status !== "Yes") {
      return NextResponse.json({ data: null, reason: "unpaid" });
    }

    // Fetch result — columns vary by school schema; adapt column names as needed
    const [rows] = await pool.query<ResultRow[]>(
      `SELECT
         r.course_id,
         COALESCE(c.title, '') AS course_title,
         r.sittings AS sitting,
         r.horen_score, r.horen_grade,
         r.lesen_score, r.lesen_grade,
         r.schreiben_score, r.schreiben_grade,
         r.sprechen_score, r.sprechen_grade,
         r.total AS total_score,
         NULL AS overall_grade
       FROM results r
       LEFT JOIN courses c ON c.id = r.course_id
       WHERE TRIM(r.reg_no) COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci
         AND r.course_id = ?
         AND r.sittings = ?
       LIMIT 1`,
      [reg_no, courseId, sitting]
    );

    if (!rows[0]) {
      return NextResponse.json({ data: null, reason: "not-found" });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    return authErrorResponse(error);
  }
}

