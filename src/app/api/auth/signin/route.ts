import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService, clientIp } from "@/lib/auth/auth-routes";
import { buildSessionCookie } from "@/lib/auth/sessions";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;
    const result = await authService.signin({
      email: body?.email,
      password: body?.password,
      clientIp: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.json(
      { signedIn: true, userId: result.userId, sessionToken: result.sessionToken, role: result.role },
      { status: 200 },
    );
    response.headers.set("Set-Cookie", buildSessionCookie(result.sessionToken));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
