import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const result = await authService.resendCode({ email: body?.email, clientIp: clientIp(request) });
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
