/**
 * Student passport-photo paths (pure helpers, no server-only import so they can
 * be unit-tested).
 *
 * Two legacy columns hold a photo reference:
 * - `stud2022.ProfileImage`  -> bare file name, e.g. "8461321659723948627.jpg"
 * - `course_reg.ProfileImage` -> relative path,  e.g. "uploads/1742…a0b.png"
 */

/**
 * Base URLs tried in order. `PROFILE_IMAGE/` is the requested location;
 * `Upload/` is what the legacy portal currently serves (both verified against
 * portal.alphadeutsch.com), so the app keeps working while the folder is moved.
 * `STUDENT_PHOTO_BASE_URL` overrides/prepends the list.
 */
export const STUDENT_PHOTO_BASES = [
  "https://portal.alphadeutsch.com/PROFILE_IMAGE/",
  "https://portal.alphadeutsch.com/Upload/",
  "https://portal.alphadeutsch.com/",
] as const;

/** Accepts only a safe relative path from the legacy columns. */
export function normalizePhotoPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (trimmed.includes("..") || trimmed.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }
  return /^[A-Za-z0-9._/-]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Ordered candidate URLs for a stored photo value. A value that already
 * contains a directory (`uploads/...`) is tried against the portal root first,
 * because those rows store the full relative path.
 */
export function photoCandidates(
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const path = normalizePhotoPath(value);
  if (!path) return [];

  const override = (env.STUDENT_PHOTO_BASE_URL ?? "").trim();
  const bases = [override, ...STUDENT_PHOTO_BASES].filter((base) => /^https?:\/\//i.test(base));
  const ordered = path.includes("/") ? bases : bases;

  const urls: string[] = [];
  for (const base of ordered) {
    const url = `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}
