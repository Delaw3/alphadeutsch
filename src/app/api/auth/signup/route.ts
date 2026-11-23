import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";
import { normalizeEmail } from "@/lib/auth/auth-errors";
import { getPool } from "@/lib/db";
import { withApiTiming } from "@/lib/monitoring/perf";

export const POST = withApiTiming("POST /api/auth/signup", async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      name?: unknown;
      password?: unknown;
    } | null;
    // If this email belongs to an existing (active) student record, send them
    // to the "already a student" setup flow instead of creating a new account.
    const email = normalizeEmail(body?.email);
    if (email) {
      try {
        const pool = getPool();
        const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
          "SELECT id FROM stud2022 WHERE LOWER(TRIM(email)) = ? AND LOWER(TRIM(status)) = 'active' LIMIT 1",
          [email],
        );
        if (rows[0]) {
          return NextResponse.json({ needsStudentSetup: true, email }, { status: 200 });
        }
      } catch {
        /* fall through to normal signup if the lookup fails */
      }
    }

    const result = await authService.signup({
      email: body?.email,
      name: body?.name,
      password: body?.password,
      clientIp: clientIp(request),
    });
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
});
