import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { getPool } from "@/lib/db";

type CourseRow = RowDataPacket & {
  id: number;
  title: string;
  display: string;
  description: string;
  price: string;
  image: string | null;
  is_open: number;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    return NextResponse.json({ error: "Invalid course id." }, { status: 400 });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query<CourseRow[]>(
      "SELECT id, title, `display`, description, CAST(price AS CHAR) AS price, image, is_open FROM courses WHERE id = ? LIMIT 1",
      [courseId],
    );
    const course = rows[0];
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    return NextResponse.json({ data: course });
  } catch {
    return NextResponse.json({ error: "Course catalogue is unavailable." }, { status: 503 });
  }
}
