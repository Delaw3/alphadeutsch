import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";
import { withApiTiming } from "@/lib/monitoring/perf";

/**
 * POST /api/auth/verify-reset-code
 *
 * Step 2 of the reset flow: consumes the e-mailed code and returns a
 * single-use ticket that step 3 exchanges for the new password.
 */
export const POST = withApiTiming("POST /api/auth/verify-reset-code", async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      code?: unknown;
    } | null;
    const result = await authService.verifyResetCode({
      email: body?.email,
      code: body?.code,
      clientIp: clientIp(request),
    });
    return NextResponse.json({ ticket: result.ticket }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
});
