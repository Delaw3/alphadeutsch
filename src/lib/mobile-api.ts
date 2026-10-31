/**
 * Mobile-safe public API client for the Alpha Deutsch Android app shell.
 *
 * Client-safe: no `server-only`, no `mysql2`, no DB credentials.
 * All course data comes from the existing hosted HTTPS backend
 * (`GET /api/courses`, `GET /api/courses/[id]`).
 */

export type MobileCourseRow = {
  id: number;
  title: string;
  display: string;
  description: string;
  price: string;
  image: string | null;
  is_open: number;
};

type CourseListResponse = {
  data?: MobileCourseRow[];
  error?: string;
};

type CourseDetailResponse = {
  data?: MobileCourseRow;
  error?: string;
};

/**
 * Base URL for public API calls.
 * - Browser/dev: relative URLs (same origin, no hardcoded host).
 * - Packaged Android WebView: set NEXT_PUBLIC_API_BASE_URL to the trusted
 *   hosted HTTPS backend, e.g. https://alphadeutsch.example
 * Never hardcodes localhost for production.
 */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return "";
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  return `${base}${path}`;
}

export async function fetchOpenCourses(signal?: AbortSignal): Promise<MobileCourseRow[]> {
  const response = await fetch(buildUrl("/api/courses"), {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(
      response.status === 503
        ? "Course catalogue is unavailable. Please try again later."
        : `Course catalogue request failed (${response.status}).`,
    );
  }
  const payload = (await response.json()) as CourseListResponse;
  if (!payload.data) throw new Error("Course catalogue returned no data.");
  return payload.data;
}

export async function fetchMobileCourse(
  id: number,
  signal?: AbortSignal,
): Promise<MobileCourseRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const response = await fetch(buildUrl(`/api/courses/${id}`), {
    cache: "no-store",
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      response.status === 503
        ? "Course details are unavailable. Please try again later."
        : `Course details request failed (${response.status}).`,
    );
  }
  const payload = (await response.json()) as CourseDetailResponse;
  return payload.data ?? null;
}

export function formatNaira(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError;
}
