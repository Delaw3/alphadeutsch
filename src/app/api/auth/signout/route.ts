import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService } from "@/lib/auth/auth-routes";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/sessions";

export async function POST(request: Request) {
  try {
    const token = readSessionCookie(request.headers.get("cookie"));
    await authService.signout(token);
    const response = NextResponse.json({ signedOut: true }, { status: 200 });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
