"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { youTubeEmbedUrl, youTubeWatchUrl } from "@/lib/learning-videos";

/**
 * Bottom-sheet (mobile) / centred dialog (wide) YouTube player.
 *
 * - Renders in a portal so the bottom nav and headers never clip it.
 * - Locks page scroll, closes on Escape or backdrop tap, moves focus to Close.
 * - Uses youtube-nocookie.com for the embed and offers an "Open in YouTube"
 *   fallback for videos whose owner disabled embedding.
 */
export function VideoPlayerSheet({
  videoId,
  title,
  onClose,
}: {
  videoId: string;
  title: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

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
        className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-app-border bg-app-surface shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:rounded-3xl"
      >
        <div className="relative aspect-video bg-black">
          <iframe
            src={youTubeEmbedUrl(videoId, { autoplay: true })}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        </div>

        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="line-clamp-2 font-black leading-tight text-app-text">{title}</p>
            <a
              href={youTubeWatchUrl(videoId)}
              target="_blank"
              rel="noreferrer"
              className="focus-ring mt-1 inline-block rounded text-[12px] font-bold text-app-muted underline underline-offset-2 hover:text-app-text"
            >
              Open in YouTube
            </a>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="focus-ring grid size-10 shrink-0 place-items-center rounded-full bg-app-surface-2 text-app-muted transition hover:text-app-text active:scale-90"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
