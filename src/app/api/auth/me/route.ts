import "server-only";

import { NextResponse } from "next/server";

import { authErrorResponse, authStores } from "@/lib/auth/auth-routes";
import { readSessionCookie, validateSessionToken } from "@/lib/auth/sessions";

/** Phase B: proves server-side session validation. No student data exposed. */
export async function GET(request: Request) {
  try {
    const token = readSessionCookie(request.headers.get("cookie"));
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const user = await authStores.users.findById(valid.userId);
    if (!user || !user.emailVerifiedAt) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json(
      { authenticated: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 200 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
