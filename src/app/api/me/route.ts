import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authStores } from "@/lib/auth/auth-routes";
import {
  readSessionCookie,
  validateSessionToken,
} from "@/lib/auth/sessions";
import { getPool } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * GET /api/me
 *
 * Returns the authenticated student's profile.
 * Accepts session via cookie OR Authorization: Bearer <token>.
 * Never returns password_hash, killer, or reset_token.
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

type StudRow = RowDataPacket & {
  reg_no: string;
  name: string | null;
  phone: string | null;
};

export async function GET(request: Request) {
  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const user = await authStores.users.findById(valid.userId);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Pull extra student fields (name, phone) from stud2022 via the session link
    let reg_no: string | null = null;
    let phone: string | null = null;
    let displayName: string = user.name ?? user.email;

    try {
      const pool = getPool();
      const [rows] = await pool.query<StudRow[]>(
        "SELECT s.reg_no, s.fullname AS name, s.phone_no AS phone FROM stud2022 s " +
          "INNER JOIN users u ON u.stud2022_id = s.id " +
          "WHERE u.id = ? LIMIT 1",
        [valid.userId]
      );
      if (rows[0]) {
        reg_no = rows[0].reg_no ?? null;
        phone = rows[0].phone ?? null;
        if (rows[0].name) displayName = rows[0].name;
      }
    } catch {
      // Non-fatal: return user data without student extras
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: displayName,
      role: user.role,
      reg_no,
      phone,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

