/**
 * "My Learning" video lessons.
 *
 * Every lesson is a YouTube video. Paste the lesson's full YouTube link into
 * `youtubeUrl` — normal watch links, youtu.be links, Shorts, Live and /embed
 * links (or a bare 11-character video id) all work:
 *
 *   youtubeUrl: "https://www.youtube.com/watch?v=AbC123dEfGh"
 *   youtubeUrl: "https://youtu.be/AbC123dEfGh"
 *   youtubeUrl: "https://www.youtube.com/shorts/AbC123dEfGh"
 *
 * Cards then use the real YouTube thumbnail and play inside the in-app player.
 * A lesson with an empty link renders a branded "coming soon" cover instead, so
 * lessons can be listed before the video is published.
 *
 * The list will move behind an admin endpoint (e.g. GET /api/learning/videos)
 * later; keep the shape stable when that happens.
 */

export type LearningVideo = {
  id: string;
  title: string;
  level: string;
  duration: string;
  /** Full YouTube link (or bare video id). Empty = not published yet. */
  youtubeUrl: string;
  /** YouTube channel shown as attribution on the lesson card. */
  channel?: string;
};

export const learningVideos: LearningVideo[] = [
  {
    id: "v1",
    title: "Alphabet & Pronunciation",
    level: "A1",
    duration: "9:36",
    youtubeUrl: "https://www.youtube.com/watch?v=TytGj8xiPyY",
    channel: "YourGermanTeacher",
  },
  {
    id: "v2",
    title: "Greetings (Begrüßungen)",
    level: "A1",
    duration: "10:03",
    youtubeUrl: "https://www.youtube.com/watch?v=RuGmc662HDg",
    channel: "Learn German",
  },
  {
    id: "v3",
    title: "Numbers 0–20 (Zahlen)",
    level: "A1",
    duration: "10:24",
    youtubeUrl: "https://www.youtube.com/watch?v=d54ioeKA-jc",
    channel: "Learn German",
  },
  {
    id: "v4",
    title: "Everyday Conversations",
    level: "A2",
    duration: "33:28",
    youtubeUrl: "https://www.youtube.com/watch?v=OiVhkabZfCg",
    channel: "GermanChat",
  },
  {
    id: "v5",
    title: "A2 Step-by-Step Crash Course",
    level: "A2",
    duration: "25:02",
    youtubeUrl: "https://www.youtube.com/watch?v=hqPa52LQcsg",
    channel: "Max Yoko",
  },
  {
    id: "v6",
    title: "Exam Tips: Hören",
    level: "B1",
    duration: "38:12",
    youtubeUrl: "https://www.youtube.com/watch?v=EjG-FV5P27A",
    channel: "Deutsch Metamorphosis",
  },
];

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PATH_PREFIXES = new Set(["embed", "shorts", "live", "v", "e"]);

/**
 * Extracts the 11-character video id from any common YouTube URL form.
 * Returns null for empty/invalid input so callers can render a placeholder.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  if (!["youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) return null;

  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\/+/, "");
    return YOUTUBE_ID_RE.test(id) ? id : null;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && YOUTUBE_ID_RE.test(fromQuery)) return fromQuery;

  const [prefix, maybeId] = url.pathname.split("/").filter(Boolean);
  if (prefix && maybeId && YOUTUBE_PATH_PREFIXES.has(prefix.toLowerCase()) && YOUTUBE_ID_RE.test(maybeId)) {
    return maybeId;
  }
  return null;
}

/** YouTube poster frame; `hqdefault` exists for every public video. */
export function youTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Privacy-friendly embed used by the in-app player. */
export function youTubeEmbedUrl(videoId: string, options: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (options.autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Level-tinted cover gradient, shared by the hero and the lesson cards. */
export function levelCoverClass(level: string): string {
  switch (level.trim().toUpperCase()) {
    case "A1":
      return "from-amber-400 to-orange-600";
    case "A2":
      return "from-sky-500 to-blue-700";
    case "B1":
      return "from-violet-500 to-purple-700";
    case "B2":
      return "from-emerald-500 to-teal-700";
    case "C1":
      return "from-rose-500 to-pink-700";
    default:
      return "from-slate-600 to-slate-900";
  }
}
