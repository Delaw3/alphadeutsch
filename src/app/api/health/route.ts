import { NextResponse } from "next/server";

import { isDatabaseReachable } from "@/lib/db";

export async function GET() {
  try {
    const reachable = await isDatabaseReachable();
    if (!reachable) {
      return NextResponse.json(
        { status: "degraded", database: "unreachable" },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "ok", database: "reachable" });
  } catch {
    // Missing env config or connection failure: never leak details.
    return NextResponse.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503 },
    );
  }
}
