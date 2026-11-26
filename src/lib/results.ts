/**
 * Result scoring helpers (pure, shared by the API and its tests).
 *
 * The legacy `results` table stores a `total` column that is unreliable: 378 of
 * 617 rows carry `total = 0` even though all four skill scores are filled in.
 * The API therefore derives the total from the skills whenever the stored value
 * is missing or not positive.
 */

/** The four skill columns as returned by `/api/me/results`. */
export type ResultSkillScores = {
  horen_score: number | null;
  lesen_score: number | null;
  schreiben_score: number | null;
  sprechen_score: number | null;
};

/**
 * Highest mark a single skill can carry in the standard layout (4 × 25 = 100).
 * Courses marked out of 100 per skill (B1/B2-style) use 4 × 100 = 400 instead.
 */
export const SKILL_MAX = 25;
export const SKILL_MAX_PERCENT = 100;

function numeric(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Sum of the four skill scores, or `null` when any skill is missing so a partial
 * result can never masquerade as a complete one.
 */
export function skillTotal(row: ResultSkillScores): number | null {
  const scores = [
    numeric(row.horen_score),
    numeric(row.lesen_score),
    numeric(row.schreiben_score),
    numeric(row.sprechen_score),
  ];
  let sum = 0;
  for (const score of scores) {
    if (score === null) return null;
    sum += score;
  }
  // `FLOAT` columns can come back as 67.99999999999999; keep two decimals.
  return Math.round(sum * 100) / 100;
}

/**
 * Effective total for a result row.
 *
 * 1. A positive stored total is the school's official figure and always wins —
 *    including the 29 rows in courses 3/4/5 whose stored total is above 100.
 * 2. With no stored total, the sum of the four skills is used. That matches the
 *    school's own convention for both scales: 4 × 25 → a total out of 100, and
 *    4 × 100 → a total out of 400 (e.g. 46+30+65+65 = 206 / 400).
 */
export function resolveResultTotal(
  row: ResultSkillScores & { total_score: number | null },
): number | null {
  const stored = numeric(row.total_score);
  if (stored !== null && stored > 0) return stored;
  return skillTotal(row);
}
