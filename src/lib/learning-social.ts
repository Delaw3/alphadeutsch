/**
 * Likes and comments for "My Learning" videos.
 *
 * Stored on the device (localStorage) for now — no server round-trip and no
 * database tables yet, so a like/comment only exists on the phone that created
 * it. When this moves to the server, keep these types and swap the read/write
 * helpers for API calls so the UI stays unchanged.
 */

export type LessonComment = {
  id: string;
  videoId: string;
  body: string;
  /** Display name captured when the comment was written. */
  author: string;
  /** ISO timestamp */
  createdAt: string;
};

export type VideoEngagement = {
  /** videoIds this device has liked */
  liked: string[];
  /** videoId -> comments, newest first */
  comments: Record<string, LessonComment[]>;
};

export const ENGAGEMENT_STORAGE_KEY = "alphadeutsch-video-engagement";
export const COMMENT_MAX_LENGTH = 500;
/** Keep the stored payload small on phones. */
const MAX_COMMENTS_PER_VIDEO = 50;

export const EMPTY_ENGAGEMENT: VideoEngagement = { liked: [], comments: {} };

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function sanitizeComment(value: unknown): LessonComment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<LessonComment>;
  if (typeof row.id !== "string" || typeof row.body !== "string") return null;
  if (typeof row.videoId !== "string" || !row.body.trim()) return null;
  return {
    id: row.id,
    videoId: row.videoId,
    body: row.body,
    author: typeof row.author === "string" && row.author.trim() ? row.author : "Student",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
}

/** Defensive parse: a corrupted or older payload never breaks the screen. */
function sanitize(value: unknown): VideoEngagement {
  if (!value || typeof value !== "object") return { liked: [], comments: {} };
  const raw = value as Partial<VideoEngagement>;

  const liked = Array.isArray(raw.liked)
    ? Array.from(new Set(raw.liked.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];

  const comments: Record<string, LessonComment[]> = {};
  if (raw.comments && typeof raw.comments === "object") {
    for (const [videoId, list] of Object.entries(raw.comments)) {
      if (!Array.isArray(list)) continue;
      const clean = list
        .map(sanitizeComment)
        .filter((item): item is LessonComment => item !== null)
        .slice(0, MAX_COMMENTS_PER_VIDEO);
      if (clean.length > 0) comments[videoId] = clean;
    }
  }

  return { liked, comments };
}

export function readEngagement(): VideoEngagement {
  try {
    const raw = window.localStorage.getItem(ENGAGEMENT_STORAGE_KEY);
    if (!raw) return { liked: [], comments: {} };
    return sanitize(JSON.parse(raw));
  } catch {
    return { liked: [], comments: {} };
  }
}

export function saveEngagement(value: VideoEngagement): void {
  try {
    window.localStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage can be unavailable (private mode) — keep the in-memory state */
  }
}

export function isLiked(engagement: VideoEngagement, videoId: string): boolean {
  return engagement.liked.includes(videoId);
}

/** Likes live on one device, so the count is 0 or 1. */
export function likeCount(engagement: VideoEngagement, videoId: string): number {
  return isLiked(engagement, videoId) ? 1 : 0;
}

export function commentCount(engagement: VideoEngagement, videoId: string): number {
  return engagement.comments[videoId]?.length ?? 0;
}

export function commentsFor(engagement: VideoEngagement, videoId: string): LessonComment[] {
  return engagement.comments[videoId] ?? [];
}

export function toggleLike(engagement: VideoEngagement, videoId: string): VideoEngagement {
  const liked = isLiked(engagement, videoId)
    ? engagement.liked.filter((id) => id !== videoId)
    : [...engagement.liked, videoId];
  return { ...engagement, liked };
}

/** Trim + collapse runs of blank lines so a comment stays readable. */
export function normalizeCommentBody(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, COMMENT_MAX_LENGTH);
}

/** Returns null when the body is empty after normalising. */
export function addComment(
  engagement: VideoEngagement,
  videoId: string,
  body: string,
  author: string,
): { engagement: VideoEngagement; comment: LessonComment } | null {
  const text = normalizeCommentBody(body);
  if (!text) return null;

  const comment: LessonComment = {
    id: newId(),
    videoId,
    body: text,
    author: author.trim() || "Student",
    createdAt: new Date().toISOString(),
  };

  const existing = engagement.comments[videoId] ?? [];
  return {
    engagement: {
      ...engagement,
      comments: {
        ...engagement.comments,
        [videoId]: [comment, ...existing].slice(0, MAX_COMMENTS_PER_VIDEO),
      },
    },
    comment,
  };
}

/** Compact "time ago" label for comment timestamps. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
