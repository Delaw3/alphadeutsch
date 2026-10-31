import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { authErrorResponse, authStores } from "@/lib/auth/auth-routes";
import { normalizeDob } from "@/lib/auth/auth-errors";
import { readSessionCookie, validateSessionToken } from "@/lib/auth/sessions";
import { getPool } from "@/lib/db";

/**
 * GET /api/me/registrations
 *
 * Returns the authenticated student's course registrations with payment status.
 * POST /api/me/registrations — guarded by FEATURE_APP_REGISTRATION (default off).
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

type RegRow = RowDataPacket & {
  id: number;
  course_id: number;
  course_title: string;
  course_display: string;
  level: string | null;
  payment_status: string;
  date_registered: string | null;
};

export async function GET(request: Request) {
  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const pool = getPool();

    // Resolve reg_no for this user via the session link (never from the client)
    const [[userRow]] = await pool.query<(RowDataPacket & { reg_no: string | null })[]>(
      "SELECT s.reg_no FROM users u " +
        "INNER JOIN stud2022 s ON u.stud2022_id = s.id " +
        "WHERE u.id = ? LIMIT 1",
      [valid.userId]
    );
    const reg_no = userRow?.reg_no?.trim();
    if (!reg_no) {
      return NextResponse.json({ data: [] });
    }

    const [rows] = await pool.query<RegRow[]>(
      `SELECT
         cr.id,
         cr.course_id,
         c.title AS course_title,
         c.display AS course_display,
         CASE
           WHEN c.title LIKE 'A1%' THEN 'A1'
           WHEN c.title LIKE 'A2%' THEN 'A2'
           WHEN c.title LIKE 'B1%' THEN 'B1'
           WHEN c.title LIKE 'B2%' THEN 'B2'
           WHEN c.title LIKE 'C1%' THEN 'C1'
           WHEN c.title LIKE 'Family Reunion%' THEN 'Family Reunion'
           ELSE NULL
         END AS level,
         cr.payment_status,
         cr.\`date\` AS date_registered
       FROM course_reg cr
       LEFT JOIN courses c ON c.id = cr.course_id
       WHERE TRIM(cr.student_reg_no) COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci
       ORDER BY cr.id DESC`,
      [reg_no]
    );

    return NextResponse.json({ data: rows });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const enabled = process.env.FEATURE_APP_REGISTRATION === "true";
  if (!enabled) {
    return NextResponse.json(
      { error: "Course registration via the app is not yet available." },
      { status: 503 }
    );
  }

  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const pool = getPool();

    const [[userRow]] = await pool.query<(RowDataPacket & { id: number; stud2022_id: number | null; email: string | null })[]>(
      "SELECT id, stud2022_id, email FROM users WHERE id = ? LIMIT 1",
      [valid.userId]
    );
    if (!userRow) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      course_id?: unknown;
      reg_no?: unknown;
      regNo?: unknown;
      fullname?: unknown;
      email?: unknown;
      phone?: unknown;
      phone_no?: unknown;
      place_of_birth?: unknown;
      dob?: unknown;
    } | null;

    const courseId = Number(body?.course_id);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return NextResponse.json({ error: "Invalid course_id." }, { status: 422 });
    }

    // Verify course is open
    const [[courseRow]] = await pool.query<(RowDataPacket & { id: number; is_open: number; title: string; price: string | number })[]>(
      "SELECT id, is_open, title, CAST(price AS CHAR) AS price FROM courses WHERE id = ? LIMIT 1",
      [courseId]
    );
    if (!courseRow) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (!courseRow.is_open) {
      return NextResponse.json({ error: "This course is not open for registration." }, { status: 422 });
    }

    // Resolve reg_no + student email: linked account uses the session link;
    // unlinked account creates/claims a stud2022 row from the student-details step.
    let resolvedRegNo = "";
    let resolvedEmail = userRow.email ?? "";

    if (userRow.stud2022_id) {
      const [[s]] = await pool.query<(RowDataPacket & { reg_no: string; email: string | null })[]>(
        "SELECT reg_no, email FROM stud2022 WHERE id = ? LIMIT 1",
        [userRow.stud2022_id]
      );
      resolvedRegNo = s?.reg_no?.trim() ?? "";
      if (s?.email) resolvedEmail = s.email;
      if (!resolvedRegNo) {
        return NextResponse.json({ error: "No student record linked to this account." }, { status: 422 });
      }
    } else {
      const rawRegNoRaw = body?.reg_no ?? body?.regNo;
    const rawRegNo = typeof rawRegNoRaw === "string" ? rawRegNoRaw.trim() : "";
      const dob = normalizeDob(body?.dob);
      const fullname = typeof body?.fullname === "string" ? body.fullname.trim() : "";
      const stuEmail = typeof body?.email === "string" ? body.email.trim() : "";
      const phoneRaw = body?.phone ?? body?.phone_no;
      const phone = typeof phoneRaw === "string" ? phoneRaw.trim() : "";
      const placeOfBirth = typeof body?.place_of_birth === "string" ? body.place_of_birth.trim() : "";

      if (!rawRegNo || !dob || !fullname || !stuEmail || !phone || !placeOfBirth) {
        return NextResponse.json(
          { error: "Student details are required (registration number, name, email, phone, place of birth, date of birth)." },
          { status: 422 }
        );
      }

      const [[existingStudent]] = await pool.query<(RowDataPacket & { id: number; reg_no: string; email: string | null; dob: string | Date })[]>(
        "SELECT id, reg_no, email, dob FROM stud2022 WHERE TRIM(reg_no) = ? LIMIT 1",
        [rawRegNo]
      );

      let studentId: number;
      if (existingStudent) {
        const existingDob = normalizeDob(existingStudent.dob);
        if (!existingDob || existingDob !== dob) {
          return NextResponse.json({ error: "Could not verify your student details." }, { status: 422 });
        }
        const alreadyLinked = await authStores.users.findByStud2022Id(existingStudent.id);
        if (alreadyLinked && alreadyLinked.id !== valid.userId) {
          return NextResponse.json({ error: "This student record is already linked to another account." }, { status: 409 });
        }
        studentId = existingStudent.id;
      } else {
        try {
          const [result] = await pool.query(
            "INSERT INTO stud2022 (fullname, email, reg_no, phone_no, place_of_birth, dob, status, ProfileImage, `super`, adminlevel) VALUES (?, ?, ?, ?, ?, ?, 'Active', '', '0', 'No')",
            [fullname, stuEmail, rawRegNo, phone, placeOfBirth, dob]
          );
          studentId = (result as { insertId?: number }).insertId ?? 0;
          if (!studentId) {
            return NextResponse.json({ error: "Could not create student record." }, { status: 500 });
          }
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "ER_DUP_ENTRY") {
            return NextResponse.json({ error: "Registration number already in use." }, { status: 409 });
          }
          throw error;
        }
      }

      await pool.query(
        "UPDATE users SET stud2022_id = ?, role = 'student' WHERE id = ?",
        [studentId, valid.userId]
      );

      resolvedRegNo = rawRegNo;
      resolvedEmail = stuEmail;
    }

    // Prevent duplicate registration
    const [[existing]] = await pool.query<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM course_reg WHERE TRIM(student_reg_no) COLLATE utf8mb4_general_ci = ? COLLATE utf8mb4_general_ci AND course_id = ? LIMIT 1",
      [resolvedRegNo, courseId]
    );
    if (existing) {
      return NextResponse.json({ error: "You are already registered for this course." }, { status: 409 });
    }

    // Only real `course_reg` columns are written.
    const courseAmount = courseRow.price == null ? null : Number(courseRow.price);

    await pool.query(
      `INSERT INTO course_reg (student_reg_no, student_email, course_id, payment_status, course_amount, \`date\`)
       VALUES (?, ?, ?, 'No', ?, CURRENT_TIMESTAMP)`,
      [resolvedRegNo, resolvedEmail, courseId, courseAmount]
    );

    return NextResponse.json(
      { message: "Registration submitted successfully.", reg_no: resolvedRegNo },
      { status: 201 }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

