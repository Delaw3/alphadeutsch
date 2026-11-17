import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { authErrorResponse, authStores } from "@/lib/auth/auth-routes";
import { readSessionCookie, validateSessionToken } from "@/lib/auth/sessions";
import { getPool } from "@/lib/db";

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function resolveToken(request: Request): string | null {
  return readBearerToken(request) ?? readSessionCookie(request.headers.get("cookie"));
}

/**
 * GET /api/me/overview
 *
 * Returns the signed-in student's dashboard counts:
 *   courses  -> number of course registrations
 *   paid     -> registrations marked paid
 *   unpaid   -> registrations not paid
 *   results  -> number of published result rows
 * Only the session user's own data is returned.
 */
export async function GET(request: Request) {
  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const pool = getPool();

    // Resolve reg_no from the session link only (never from the client).
    const [[link]] = await pool.query<(RowDataPacket & { reg_no: string | null })[]>(
      "SELECT s.reg_no FROM users u INNER JOIN stud2022 s ON u.stud2022_id = s.id WHERE u.id = ? LIMIT 1",
      [valid.userId],
    );
    const regNo = link?.reg_no?.trim();
    if (!regNo) {
      return NextResponse.json({ linked: false, courses: 0, paid: 0, unpaid: 0, results: 0 });
    }

    const [[reg]] = await pool.query<
      (RowDataPacket & { total: number | string; paid: number | string | null; unpaid: number | string | null })[]
    >(
      `SELECT COUNT(*) AS total,
              SUM(payment_status = 'Yes') AS paid,
              SUM(payment_status <> 'Yes') AS unpaid
       FROM course_reg
       WHERE TRIM(student_reg_no) COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci`,
      [regNo],
    );

    const [[res]] = await pool.query<(RowDataPacket & { n: number | string })[]>(
      `SELECT COUNT(*) AS n FROM results
       WHERE TRIM(reg_no) COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci`,
      [regNo],
    );

    return NextResponse.json({
      linked: true,
      courses: Number(reg?.total ?? 0) || 0,
      paid: Number(reg?.paid ?? 0) || 0,
      unpaid: Number(reg?.unpaid ?? 0) || 0,
      results: Number(res?.n ?? 0) || 0,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
