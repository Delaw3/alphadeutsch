import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authService } from "@/lib/auth/auth-routes";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/sessions";

/** Mobile (Capacitor) sends `Authorization: Bearer <sessionToken>`. */
function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function POST(request: Request) {
  try {
    // Bearer first (mobile), then the browser session cookie. The same session
    // token is stored in either channel, so `signout` revokes the matching row.
    const token =
      readBearerToken(request) ?? readSessionCookie(request.headers.get("cookie"));
    await authService.signout(token);
    const response = NextResponse.json({ signedOut: true }, { status: 200 });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
