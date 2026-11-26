import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";
import { withApiTiming } from "@/lib/monitoring/perf";

/**
 * Account signup.
 *
 * The whole decision order lives in `AuthService.signup`: an existing app
 * account always wins over the `stud2022` student lookup, so a student who
 * already completed the mobile setup is sent to sign-in instead of being shown
 * the "already a student" setup form again.
 */
export const POST = withApiTiming("POST /api/auth/signup", async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      name?: unknown;
      password?: unknown;
    } | null;
    const result = await authService.signup({
      email: body?.email,
      name: body?.name,
      password: body?.password,
      clientIp: clientIp(request),
    });
    return NextResponse.json(
      {
        message: result.message,
        // Only present for a student record that has no app account yet.
        ...(result.needsStudentSetup ? { needsStudentSetup: true, email: result.email } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
});
