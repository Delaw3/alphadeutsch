import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      code?: unknown;
    } | null;
    const result = await authService.verifyEmail({
      email: body?.email,
      code: body?.code,
      clientIp: clientIp(request),
    });
    return NextResponse.json({ verified: true, userId: result.userId }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
