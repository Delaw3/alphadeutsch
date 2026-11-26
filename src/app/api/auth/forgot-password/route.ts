import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";
import { withApiTiming } from "@/lib/monitoring/perf";

/**
 * POST /api/auth/forgot-password
 *
 * Step 1 of the reset flow: e-mails a 6-digit code to a verified account.
 * The response is identical whether or not the address exists.
 */
export const POST = withApiTiming("POST /api/auth/forgot-password", async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const result = await authService.requestPasswordReset({
      email: body?.email,
      clientIp: clientIp(request),
    });
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
});
