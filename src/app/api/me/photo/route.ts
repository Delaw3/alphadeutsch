import "server-only";

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";

import { authStores } from "@/lib/auth/auth-routes";
import { readSessionCookie, validateSessionToken } from "@/lib/auth/sessions";
import { getPool } from "@/lib/db";
import { logUnexpectedError, withApiTiming } from "@/lib/monitoring/perf";
import { photoCandidates } from "@/lib/student-photo";

/** Largest photo accepted from the legacy portal (5 MB). */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Upstream fetch timeout; keeps the route inside the function budget. */
const UPSTREAM_TIMEOUT_MS = 8_000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function resolveToken(request: Request): string | null {
  return readBearerToken(request) ?? readSessionCookie(request.headers.get("cookie"));
}

/**
 * GET /api/me/photo
 *
 * Streams the signed-in student's passport photo from the legacy portal.
 * Serving it through this route means the image URL never reaches the client,
 * the portal never has to allow hotlinking/CORS, and only the owner can read it
 * (`Cache-Control: private`).
 */
export const GET = withApiTiming("GET /api/me/photo", async (request: Request) => {
  try {
    const token = resolveToken(request);
    const valid = await validateSessionToken(authStores.sessions, token);
    if (!valid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const pool = getPool();
    const [[row]] = await pool.query<(RowDataPacket & { ProfileImage: string | null })[]>(
      "SELECT s.ProfileImage FROM users u " +
        "INNER JOIN stud2022 s ON u.stud2022_id = s.id " +
        "WHERE u.id = ? LIMIT 1",
      [valid.userId],
    );

    const candidates = photoCandidates(row?.ProfileImage ?? null);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "No photo on file." }, { status: 404 });
    }

    for (const url of candidates) {
      let response: Response;
      try {
        response = await fetch(url, {
          cache: "no-store",
          redirect: "follow",
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
      } catch {
        continue; // try the next candidate base
      }
      if (!response.ok) continue;

      const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (!ALLOWED_TYPES.includes(contentType)) continue;

      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_PHOTO_BYTES) continue;

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json({ error: "Photo is unavailable." }, { status: 404 });
  } catch (error) {
    logUnexpectedError(error);
    return NextResponse.json({ error: "Photo service is unavailable." }, { status: 502 });
  }
});
