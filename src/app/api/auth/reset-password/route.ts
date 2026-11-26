import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";
import { withApiTiming } from "@/lib/monitoring/perf";

/**
 * POST /api/auth/reset-password
 *
 * Step 3 of the reset flow: exchanges the single-use ticket for a new password
 * and revokes every existing session for the account.
 */
export const POST = withApiTiming("POST /api/auth/reset-password", async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      ticket?: unknown;
      password?: unknown;
    } | null;
    const result = await authService.resetPassword({
      email: body?.email,
      ticket: body?.ticket,
      password: body?.password,
      clientIp: clientIp(request),
    });
    return NextResponse.json({ reset: result.reset }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
});
