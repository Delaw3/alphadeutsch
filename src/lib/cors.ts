import { NextResponse } from "next/server";

/**
 * Shared CORS policy for the API.
 *
 * Only these exact origins may read responses from the API:
 *   1. https://alphadeutsch.vercel.app  - existing production web application
 *   2. https://localhost                - Capacitor Android WebView origin
 *   3. capacitor://localhost            - Capacitor / iOS WebView origin
 *
 * Deliberate choices:
 *  - The allowed origin is reflected back, never "*".
 *  - `Vary: Origin` is always sent so shared caches never leak one origin's
 *    permission to another.
 *  - `Access-Control-Allow-Credentials` is intentionally absent: the mobile
 *    app authenticates with `Authorization: Bearer`, and the browser app is
 *    same-origin so it never needs CORS for cookies. Cookie auth keeps working
 *    untouched because this module never reads or writes cookies.
 *  - Requests from any other origin get no CORS permission headers at all.
 */

export const ALLOWED_ORIGINS = [
  "https://alphadeutsch.vercel.app",
  "https://localhost",
  "capacitor://localhost",
] as const;

export const ALLOWED_METHODS = "GET, POST, OPTIONS";
export const ALLOWED_HEADERS = "Authorization, Content-Type";
export const PREFLIGHT_MAX_AGE_SECONDS = "600";

/** True only for an exact (case-insensitive, per URL spec) allowed origin. */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  const candidate = origin.trim().toLowerCase();
  if (!candidate) return false;
  return ALLOWED_ORIGINS.some((allowed) => allowed === candidate);
}

/**
 * Headers to attach to a normal (non-preflight) API response.
 * Always includes `Vary: Origin`; permission headers only for allowed origins.
 */
export function corsHeadersFor(origin: string | null | undefined): Headers {
  const headers = new Headers();
  headers.set("Vary", "Origin");

  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin!.trim());
    headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    headers.set("Access-Control-Max-Age", PREFLIGHT_MAX_AGE_SECONDS);
  }

  return headers;
}

/**
 * 204 preflight response. Disallowed origins still get 204 (so OPTIONS is
 * never treated as an error) but without any `Access-Control-*` header, which
 * is what makes the browser reject the real request.
 */
export function preflightResponse(origin: string | null | undefined): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(origin) });
}

/** Copies CORS headers onto an existing response without touching other headers. */
export function applyCorsHeaders(response: NextResponse, origin: string | null | undefined): NextResponse {
  corsHeadersFor(origin).forEach((value, key) => response.headers.set(key, value));
  return response;
}
