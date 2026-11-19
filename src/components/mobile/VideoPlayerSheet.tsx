"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, MessageCircle, Send, X } from "lucide-react";

import { givenName } from "@/lib/names";
import {
  COMMENT_MAX_LENGTH,
  formatRelativeTime,
  normalizeCommentBody,
  type LessonComment,
} from "@/lib/learning-social";
import { youTubeEmbedUrl, youTubeWatchUrl } from "@/lib/learning-videos";

/**
 * Bottom-sheet (mobile) / centred dialog (wide) YouTube player.
 *
 * Also hosts the lesson's heart button and comment thread. Likes and comments
 * are stored on this device (see src/lib/learning-social.ts).
 *
 * - Renders in a portal so the bottom nav and headers never clip it.
 * - Locks page scroll, closes on Escape or backdrop tap, moves focus to Close.
 */
export function VideoPlayerSheet({
  videoId,
  title,
  liked,
  likeCount,
  comments,
  onToggleLike,
  onAddComment,
  onClose,
}: {
  videoId: string;
  title: string;
  liked: boolean;
  likeCount: number;
  comments: LessonComment[];
  onToggleLike: () => void;
  /** Returns false when the text was empty after trimming. */
  onAddComment: (body: string) => boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!normalizeCommentBody(draft)) {
        setNotice("Write a comment first.");
        return;
      }
      if (onAddComment(draft)) {
        setDraft("");
        setNotice("Comment added.");
      }
    },
    [draft, onAddComment],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-app-border bg-app-surface shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:rounded-3xl"
      >
        <div className="relative aspect-video shrink-0 bg-black">
          <iframe
            src={youTubeEmbedUrl(videoId, { autoplay: true })}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        </div>

        <div className="shrink-0 border-b border-app-border px-4 py-3">
          <div className="flex items-start gap-2">
            <p className="line-clamp-1 min-w-0 flex-1 text-[13px] font-black text-app-text">{title}</p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close player"
              className="focus-ring -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-app-surface-2 text-app-muted transition hover:text-app-text active:scale-90"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleLike}
              aria-pressed={liked}
              aria-label={liked ? "Remove your like" : "Like this lesson"}
              className={`focus-ring inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12px] font-black transition active:scale-95 ${
                liked
                  ? "bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400"
                  : "bg-app-surface-2 text-app-muted"
              }`}
            >
              <Heart size={15} strokeWidth={2.2} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 ? likeCount : "Like"}
            </button>
            <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-app-surface-2 px-3 text-[12px] font-black text-app-muted">
              <MessageCircle size={15} strokeWidth={2.2} />
              {comments.length}
            </span>
            <a
              href={youTubeWatchUrl(videoId)}
              target="_blank"
              rel="noreferrer"
              className="focus-ring ml-auto rounded text-[11px] font-bold text-app-muted underline underline-offset-2 hover:text-app-text"
            >
              Open in YouTube
            </a>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-app-muted">
            Comments
          </p>

          {comments.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-app-surface-2 px-3 py-5 text-center text-[12px] font-bold text-app-muted">
              No comments yet — ask a question or share a tip.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2.5">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-2xl bg-app-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-app-accent text-[11px] font-black text-app-on-accent"
                    >
                      {givenName(comment.author)[0]?.toUpperCase() ?? "S"}
                    </span>
                    <p className="min-w-0 truncate text-[12px] font-black text-app-text">
                      {givenName(comment.author)}
                    </p>
                    <span className="ml-auto shrink-0 text-[11px] font-bold text-app-muted">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-5 text-app-text">
                    {comment.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submit} className="shrink-0 border-t border-app-border bg-app-surface p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value.slice(0, COMMENT_MAX_LENGTH));
                setNotice(null);
              }}
              rows={2}
              maxLength={COMMENT_MAX_LENGTH}
              placeholder="Add a comment…"
              aria-label="Write a comment"
              className="focus-ring min-h-[44px] flex-1 resize-none rounded-2xl border border-app-border bg-app-surface-2 px-3 py-2 text-[13px] leading-5 text-app-text placeholder:text-app-muted"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Post comment"
              className="focus-ring grid size-11 shrink-0 place-items-center rounded-full bg-app-accent text-app-on-accent transition active:scale-95 disabled:opacity-60"
            >
              <Send size={17} strokeWidth={2.2} />
            </button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-app-muted"
          >
            <span>{notice ?? "Saved on this device."}</span>
            <span className="tabular-nums">
              {COMMENT_MAX_LENGTH - draft.length}
            </span>
          </p>
        </form>
      </div>
    </div>,
    document.body,
  );
}
