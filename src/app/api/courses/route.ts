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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const openOnly = searchParams.get("open");

    // Default to open courses for the mobile catalogue; ?open=all includes closed rows.
    const filterOpen = openOnly !== "all";
    const sql = filterOpen
      ? "SELECT id, title, `display`, description, CAST(price AS CHAR) AS price, image, is_open FROM courses WHERE is_open = 1 ORDER BY id ASC"
      : "SELECT id, title, `display`, description, CAST(price AS CHAR) AS price, image, is_open FROM courses ORDER BY id ASC";

    const pool = getPool();
    const [rows] = await pool.query<CourseRow[]>(sql);
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: "Course catalogue is unavailable." }, { status: 503 });
  }
}
