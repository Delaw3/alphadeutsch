import { NextResponse } from "next/server";

import { isDatabaseReachable } from "@/lib/db";
import { logUnexpectedError, withApiTiming } from "@/lib/monitoring/perf";

export const GET = withApiTiming("GET /api/health", async () => {
  try {
    const reachable = await isDatabaseReachable();
    if (!reachable) {
      return NextResponse.json(
        { status: "degraded", database: "unreachable" },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "ok", database: "reachable" });
  } catch (error) {
    // Missing env config or connection failure: never leak details in the body.
    logUnexpectedError(error);
    return NextResponse.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503 },
    );
  }
});

