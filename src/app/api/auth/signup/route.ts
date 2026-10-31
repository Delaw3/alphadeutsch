import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";

export async function POST(request: Request) {
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
    return NextResponse.json({ message: result.message }, { status: 200 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
