import type { ReactNode } from "react";

/**
 * Static-parameter source for the client-side course detail page.
 *
 * `page.tsx` is a client component, so it cannot export `generateStaticParams`
 * itself. This server layout supplies the params, letting `output: "export"`
 * prerender one shell per course id while the page still fetches live data via
 * `mobile-api.ts`.
 *
 * Web builds are untouched: without BUILD_TARGET=mobile this returns an empty
 * list, so the route stays dynamic exactly as before (dynamicParams is left at
 * its default so every id keeps working at runtime).
 */
const FALLBACK_COURSE_IDS = Array.from({ length: 24 }, (_, i) => i + 1);

async function resolveCourseIds(): Promise<number[]> {
  const configured = process.env.MOBILE_COURSE_IDS?.trim();
  if (configured) {
    const ids = configured
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length) return ids;
  }

  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (base) {
    try {
      const response = await fetch(`${base}/api/courses?open=all`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const payload = (await response.json()) as { data?: { id?: unknown }[] };
        const ids = (payload.data ?? [])
          .map((row) => Number(row.id))
          .filter((id) => Number.isInteger(id) && id > 0);
        if (ids.length) return [...new Set(ids)];
      }
    } catch {
      // Offline build: fall back to the known catalogue size below.
    }
  }

  return FALLBACK_COURSE_IDS;
}

export async function generateStaticParams() {
  if (process.env.BUILD_TARGET !== "mobile") return [];
  const ids = await resolveCourseIds();
  console.log(`[courses/[id]] prerendering ${ids.length} course shells`);
  return ids.map((id) => ({ id: String(id) }));
}

export default function CourseDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
