import { NextResponse, type NextRequest } from "next/server";

import { corsHeadersFor, preflightResponse } from "@/lib/cors";

/**
 * CORS for every API route handler (all 15), applied in one place so no
 * handler body, business logic or cookie handling is rewritten.
 *
 * File convention: `proxy.ts` is the Next 16 replacement for `middleware.ts`
 * (the old name builds with a deprecation warning). Because this file has the
 * `.ts` extension and the mobile build sets `pageExtensions` to tsx/jsx/js, it
 * is invisible to `output: "export"` — the static bundle stays unaffected.
 *
 * - OPTIONS  -> 204 with CORS headers (no Access-Control-* for other origins)
 * - others   -> the handler's own response (success or error) is returned with
 *               CORS headers merged on top; Set-Cookie and any handler headers
 *               are left untouched.
 */
export const config = {
  matcher: ["/api/:path*"],
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return preflightResponse(origin);
  }

  const response = NextResponse.next();
  corsHeadersFor(origin).forEach((value, key) => response.headers.set(key, value));
  return response;
}
