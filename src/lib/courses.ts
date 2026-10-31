import "server-only";

import type { Course, CourseMode } from "@/types";

export type ApiCourseRow = {
  id: number;
  title: string;
  display: string;
  description: string;
  price: string;
  image: string | null;
  is_open: number;
};

type ApiCourseListResponse = {
  data?: ApiCourseRow[];
  error?: string;
};

const MODE_DURATIONS: Record<string, string> = {
  "On-Site": "9 weeks, 144 hours. Morning, Afternoon, and Evening sessions.",
  Online: "Individually determined and adapted to the student's schedule.",
  Private: "Individually determined and adapted to the student's schedule.",
  "Online Private": "Individually determined and adapted to the student's schedule.",
};

const LEVEL_META: Record<string, { level: string; outcomes: string[] }> = {
  "A1 Elementary": {
    level: "A1",
    outcomes: [
      "Understand basic German expressions",
      "Introduce yourself and others",
      "Prepare for internationally recognized A1 expectations",
    ],
  },
  "A2 Elementary": {
    level: "A2",
    outcomes: [
      "Hold routine conversations",
      "Write short practical messages",
      "Build confidence for the A2 level",
    ],
  },
  "B1 Independent": {
    level: "B1",
    outcomes: ["Discuss familiar topics", "Prepare structured essays", "Practice B1 exam formats"],
  },
  "B2 Independent": {
    level: "B2",
    outcomes: ["Argue opinions clearly", "Read complex articles", "Refine grammar accuracy"],
  },
  "C1 Autonomous": {
    level: "C1",
    outcomes: ["Speak with nuance", "Write academic texts", "Master complex listening tasks"],
  },
  "Family Reunion": {
    level: "FR",
    outcomes: [
      "Practice interview questions",
      "Learn practical vocabulary",
      "Prepare with a private tutor",
    ],
  },
};

function formatPrice(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `\u20a6${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function levelKey(title: string): string {
  if (title.startsWith("Family")) return "Family Reunion";
  const level = title.split(" ")[0] ?? title;
  const rest = title.slice(level.length).trim();
  return `${level} ${rest}`;
}

/**
 * Group flat `courses` rows (one per title x display mode) into the
 * level cards the catalogue UI renders. Server-side only.
 */
export function groupCourseRows(rows: ApiCourseRow[]): (Course & { ids: number[] })[] {
  const groups = new Map<string, Course & { ids: number[] }>();
  for (const row of rows) {
    const key = levelKey(row.title);
    const meta = LEVEL_META[key] ?? {
      level: key.slice(0, 2).toUpperCase(),
      outcomes: [] as string[],
    };
    const mode = row.display as CourseMode;
    const existing = groups.get(key);
    const priceEntry = {
      mode,
      price: formatPrice(row.price),
      duration: MODE_DURATIONS[row.display] ?? "Contact Alpha Deutsch for schedule details.",
    };
    if (existing) {
      if (!existing.prices.some((item) => item.mode === mode)) {
        existing.prices.push(priceEntry);
      }
      existing.ids.push(row.id);
    } else {
      const [level, ...rest] = row.title.split(" ");
      groups.set(key, {
        level: meta.level || level,
        title: rest.join(" ") || row.title,
        prices: [priceEntry],
        description: row.description,
        outcomes: meta.outcomes,
        ids: [row.id],
      });
    }
  }
  return [...groups.values()];
}

async function fetchRows(path: string): Promise<ApiCourseRow[]> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const response = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Course API responded with ${response.status}`);
  }
  const payload = (await response.json()) as ApiCourseListResponse;
  if (!payload.data) {
    throw new Error("Course API returned no data.");
  }
  return payload.data;
}

/** Open courses for the public catalogue. Throws on API failure. */
export async function getOpenCourseGroups(): Promise<(Course & { ids: number[] })[]> {
  return groupCourseRows(await fetchRows("/api/courses"));
}

/** Single course row by id, or null when missing. Throws on API failure. */
export async function getCourseRow(id: number): Promise<ApiCourseRow | null> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const response = await fetch(`${base}/api/courses/${id}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Course API responded with ${response.status}`);
  }
  const payload = (await response.json()) as { data?: ApiCourseRow };
  return payload.data ?? null;
}
