"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, Heart, Lock, MessageCircle, Play } from "lucide-react";

import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { givenName } from "@/lib/names";
import {
  addComment as addCommentToStore,
  commentCount,
  commentsFor,
  EMPTY_ENGAGEMENT,
  isLiked,
  likeCount,
  readEngagement,
  saveEngagement,
  toggleLike,
  type VideoEngagement,
} from "@/lib/learning-social";
import {
  learningVideos,
  levelCoverClass,
  parseYouTubeId,
  youTubeThumbnail,
  type LearningVideo,
} from "@/lib/learning-videos";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { MobileStateCard } from "@/components/mobile/MobileStates";
import { VideoPlayerSheet } from "@/components/mobile/VideoPlayerSheet";

type Me = {
  name: string;
  email: string;
  role: string;
};

type Registration = { payment_status: string; level?: string | null };

type Status = "loading" | "ready" | "unauthenticated" | "error";

type Lesson = LearningVideo & { videoId: string | null };

const WATCHED_KEY = "alphadeutsch-watched-videos";

function readWatched(): string[] {
  try {
    const raw = window.localStorage.getItem(WATCHED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export default function LearningPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [level, setLevel] = useState("All");
  const [watched, setWatched] = useState<string[]>([]);
  const [activeVideo, setActiveVideo] = useState<{ videoId: string; title: string } | null>(null);
  // Likes and comments are device-local until a server API exists.
  const [engagement, setEngagement] = useState<VideoEngagement>(EMPTY_ENGAGEMENT);

  // Each lesson resolves to a YouTube id once its link is pasted in
  // src/lib/learning-videos.ts; null means "not published yet".
  const lessons = useMemo<Lesson[]>(
    () => learningVideos.map((lesson) => ({ ...lesson, videoId: parseYouTubeId(lesson.youtubeUrl) })),
    [],
  );

  useEffect(() => {
    setWatched(readWatched());
    setEngagement(readEngagement());
  }, []);

  useEffect(() => {
    if (!hasSessionToken()) {
      setStatus("unauthenticated");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    Promise.all([
      apiFetch<Me>("/api/me"),
      apiFetch<{ data: Registration[] }>("/api/me/registrations"),
    ])
      .then(([meData, regData]) => {
        if (cancelled) return;
        setMe(meData);
        setRegs(regData.data ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const openLesson = useCallback((lesson: Lesson) => {
    if (!lesson.videoId) return;
    setActiveVideo({ videoId: lesson.videoId, title: lesson.title });
    setWatched((prev) => {
      if (prev.includes(lesson.id)) return prev;
      const next = [...prev, lesson.id];
      try {
        window.localStorage.setItem(WATCHED_KEY, JSON.stringify(next));
      } catch {
        /* storage can be unavailable (private mode) */
      }
      return next;
    });
  }, []);

  const closePlayer = useCallback(() => setActiveVideo(null), []);

  const toggleLikeFor = useCallback(
    (videoId: string) => {
      const next = toggleLike(engagement, videoId);
      setEngagement(next);
      saveEngagement(next);
    },
    [engagement],
  );

  const addCommentFor = useCallback(
    (videoId: string, body: string) => {
      const author = givenName(me?.name) || "Student";
      const result = addCommentToStore(engagement, videoId, body, author);
      if (!result) return false;
      setEngagement(result.engagement);
      saveEngagement(result.engagement);
      return true;
    },
    [engagement, me?.name],
  );

  const unpaidCount = regs.filter((r) => r.payment_status !== "Yes").length;
  const firstName = givenName(me?.name) || "Student";

  // Level chips: "All", then the student's own course levels, then the rest.
  const lessonLevels = useMemo(() => Array.from(new Set(lessons.map((l) => l.level))), [lessons]);
  const myLevels = useMemo(() => {
    const owned = regs
      .map((r) => r.level?.trim().toUpperCase())
      .filter((l): l is string => Boolean(l) && lessonLevels.includes(l as string));
    return Array.from(new Set(owned));
  }, [regs, lessonLevels]);
  const levelChips = ["All", ...myLevels, ...lessonLevels.filter((l) => !myLevels.includes(l))];

  const visibleLessons = level === "All" ? lessons : lessons.filter((l) => l.level === level);
  const watchedCount = lessons.filter((l) => watched.includes(l.id)).length;
  const watchedPct = lessons.length === 0 ? 0 : Math.round((watchedCount / lessons.length) * 100);
  const featured = lessons[0] ?? null;
  const featuredVideoId = featured?.videoId ?? null;

  if (status === "loading") {
    return (
      <MobileScreen title="Loading…">
        <div role="status" aria-label="Loading your profile" className="flex justify-center py-10">
          <MiniSpinner className="size-8" />
        </div>
      </MobileScreen>
    );
  }

  if (status === "unauthenticated") {
    return (
      <MobileScreen title="Sign in required">
        <MobileStateCard
          icon={<Lock size={24} strokeWidth={2} />}
          title="You are not signed in"
          description="Sign in to watch your video tutorials and track your progress."
          action={
            <Link href="/sign-in" className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent">Sign in</Link>
          }
        />
      </MobileScreen>
    );
  }

  if (status === "error") {
    return (
      <MobileScreen title="Something went wrong">
        <MobileStateCard
          icon={<AlertTriangle size={24} strokeWidth={2} />}
          title="Could not load your data"
          description="Please check your connection and try again."
          action={
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setReloadKey((key) => key + 1);
              }}
              className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent"
            >
              Try again
            </button>
          }
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen description="Watch video tutorials from your instructors.">
      {unpaidCount > 0 ? (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-[13px] font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300">
          You have {unpaidCount} unpaid course{unpaidCount > 1 ? "s" : ""}.{" "}
          <Link href="/pay" className="underline underline-offset-2">Pay now</Link>
        </div>
      ) : null}

      {/* HERO / FEATURED LESSON */}
      {featured ? (
        <>
          <button
          type="button"
          onClick={() => openLesson(featured)}
          disabled={!featured.videoId}
          aria-label={featured.videoId ? `Watch ${featured.title}` : `${featured.title} — video coming soon`}
          className="focus-ring group relative block w-full overflow-hidden rounded-3xl border border-app-border text-left shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition active:scale-[0.99] disabled:active:scale-100"
        >
          <div className="relative aspect-[16/9] w-full">
            <div className={`relative size-full overflow-hidden bg-gradient-to-br ${levelCoverClass(featured.level)}`}>
              {featured.videoId ? (
                <img
                  src={youTubeThumbnail(featured.videoId)}
                  alt=""
                  onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <span aria-hidden="true" className="absolute -right-3 bottom-0 text-[110px] font-black leading-none text-white/20">{featured.level}</span>
              )}
            </div>
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
            <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/30 backdrop-blur-md">
              Featured lesson
            </span>
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-black/40 text-white ring-1 ring-white/45 backdrop-blur-md transition group-hover:bg-app-accent group-hover:text-app-on-accent group-active:scale-95">
                {featured.videoId ? (
                  <Play size={22} strokeWidth={2} fill="currentColor" />
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-wide">Soon</span>
                )}
              </span>
            </span>
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/75">
                <span>{featured.level}</span>
                <span aria-hidden="true" className="size-1 rounded-full bg-white/50" />
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} strokeWidth={2} />
                  {featured.duration}
                </span>
              </p>
              <p className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white">{featured.title}</p>
              <p className="mt-2 text-[12px] font-bold text-white/80">
                {featured.videoId
                  ? featured.channel
                    ? `Tap to watch · ${featured.channel}`
                    : "Tap to watch now"
                  : "Video link coming soon"}
              </p>
            </div>
          </div>
        </button>

          {featuredVideoId ? (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleLikeFor(featuredVideoId)}
                aria-pressed={isLiked(engagement, featuredVideoId)}
                aria-label={
                  isLiked(engagement, featuredVideoId)
                    ? `Remove your like from ${featured.title}`
                    : `Like ${featured.title}`
                }
                className={`focus-ring inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[12px] font-black transition active:scale-95 ${
                  isLiked(engagement, featuredVideoId)
                    ? "bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400"
                    : "bg-app-surface text-app-muted ring-1 ring-app-border"
                }`}
              >
                <Heart
                  size={15}
                  strokeWidth={2.2}
                  fill={isLiked(engagement, featuredVideoId) ? "currentColor" : "none"}
                />
                {likeCount(engagement, featuredVideoId) > 0
                  ? likeCount(engagement, featuredVideoId)
                  : "Like"}
              </button>
              <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-app-surface px-3.5 text-[12px] font-black text-app-muted ring-1 ring-app-border">
                <MessageCircle size={15} strokeWidth={2.2} />
                {commentCount(engagement, featuredVideoId)}
              </span>
              <span className="ml-auto truncate text-[11px] font-bold text-app-muted">
                {featured.channel ?? ""}
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      {/* LESSON LIBRARY */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-app-muted">Video tutorials</h2>
          <span className="text-[12px] font-bold text-app-muted">
            {level === "All" ? `${lessons.length} lessons` : `${visibleLessons.length} of ${lessons.length} lessons`}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-surface-2" role="presentation">
            <div className="h-full rounded-full bg-app-accent transition-[width] duration-500" style={{ width: `${watchedPct}%` }} />
          </div>
          <span className="text-[11px] font-black tabular-nums text-app-muted">
            {watchedCount}/{lessons.length} watched
          </span>
        </div>

        <div role="tablist" aria-label="Filter lessons by level" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {levelChips.map((item) => {
            const active = item === level;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLevel(item)}
                className={`focus-ring inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-black transition active:scale-[0.98] ${
                  active
                    ? "bg-app-accent text-app-on-accent"
                    : "bg-app-surface text-app-muted ring-1 ring-app-border"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {visibleLessons.map((lesson) => {
            const isWatched = watched.includes(lesson.id);
            const videoId = lesson.videoId;
            const liked = videoId ? isLiked(engagement, videoId) : false;
            const likes = videoId ? likeCount(engagement, videoId) : 0;
            const commentsTotal = videoId ? commentCount(engagement, videoId) : 0;
            return (
              <div
                key={lesson.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm transition hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => openLesson(lesson)}
                  disabled={!videoId}
                  aria-label={videoId ? `Watch ${lesson.title}` : `${lesson.title} — video coming soon`}
                  className="focus-ring group block text-left"
                >
                <div className="relative aspect-video overflow-hidden">
                  <div className={`relative size-full overflow-hidden bg-gradient-to-br ${levelCoverClass(lesson.level)}`}>
                    {lesson.videoId ? (
                      <img
                        src={youTubeThumbnail(lesson.videoId)}
                        alt=""
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span aria-hidden="true" className="absolute -right-1 bottom-0 text-[58px] font-black leading-none text-white/20">{lesson.level}</span>
                    )}
                  </div>
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/20 backdrop-blur-sm">
                    {lesson.level}
                  </span>

                  {isWatched ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow">
                      <Check size={11} strokeWidth={3} />
                      Watched
                    </span>
                  ) : null}

                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                    {lesson.duration}
                  </span>

                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
                    <span className="grid size-10 place-items-center rounded-full bg-black/40 text-white ring-1 ring-white/45 backdrop-blur-sm transition group-hover:bg-app-accent group-hover:text-app-on-accent">
                      {lesson.videoId ? (
                        <Play size={15} strokeWidth={2} fill="currentColor" />
                      ) : (
                        <span className="text-[8px] font-black uppercase tracking-wide">Soon</span>
                      )}
                    </span>
                  </span>
                </div>

                <div className="p-3">
                  <p className="line-clamp-2 text-[13px] font-black leading-tight text-app-text">{lesson.title}</p>
                  <p className="mt-1 truncate text-[11px] font-bold text-app-muted">
                    {videoId ? (lesson.channel ?? "Tap to watch") : "Link coming soon"}
                  </p>
                </div>
                </button>

                <div className="mt-auto flex items-center gap-1 border-t border-app-border px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => videoId && toggleLikeFor(videoId)}
                    disabled={!videoId}
                    aria-pressed={liked}
                    aria-label={liked ? `Remove your like from ${lesson.title}` : `Like ${lesson.title}`}
                    className={`focus-ring inline-flex min-h-[32px] items-center gap-1 rounded-full px-2 text-[11px] font-black transition active:scale-95 disabled:opacity-50 ${
                      liked
                        ? "bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400"
                        : "text-app-muted hover:text-app-text"
                    }`}
                  >
                    <Heart size={14} strokeWidth={2.2} fill={liked ? "currentColor" : "none"} />
                    {likes > 0 ? likes : null}
                  </button>
                  <span className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2 text-[11px] font-bold text-app-muted">
                    <MessageCircle size={13} strokeWidth={2.2} />
                    {commentsTotal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {visibleLessons.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-app-border bg-app-surface px-4 py-6 text-center text-[13px] font-bold text-app-muted">
            No lessons for this level yet.
          </p>
        ) : null}

        <p className="mt-3 text-[12px] text-app-muted">
          New lessons added by your instructor appear here automatically.
        </p>
      </section>

      <MobileCard>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-3xl bg-app-accent text-xl font-black text-app-on-accent">
            {firstName[0]?.toUpperCase() ?? "A"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black text-app-text">{me?.name}</p>
            <p className="truncate text-[13px] text-app-muted">{me?.email}</p>
          </div>
        </div>
      </MobileCard>

      {activeVideo ? (
        <VideoPlayerSheet
          videoId={activeVideo.videoId}
          title={activeVideo.title}
          liked={isLiked(engagement, activeVideo.videoId)}
          likeCount={likeCount(engagement, activeVideo.videoId)}
          comments={commentsFor(engagement, activeVideo.videoId)}
          onToggleLike={() => toggleLikeFor(activeVideo.videoId)}
          onAddComment={(body) => addCommentFor(activeVideo.videoId, body)}
          onClose={closePlayer}
        />
      ) : null}

    </MobileScreen>
  );
}
