import Link from "next/link";

/**
 * Friendly fallback for `/courses/level/<unknown>`.
 *
 * Rendered by `notFound()` from the level page. Works in both builds:
 *  - web: any unknown param renders here (dynamic params);
 *  - Android: Capacitor serves `index.html` for extension-less paths, the client
 *    router resolves the level route, and this boundary renders instead of a
 *    blank screen or the default 404.
 *
 * Nothing here depends on the server, so the static export stays intact.
 */
export default function LevelNotFound() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-[16rem] pt-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/courses"
          className="focus-ring inline-flex items-center gap-1 text-[13px] font-bold text-app-muted"
        >
          ‹ Levels
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <h1 className="text-lg font-black text-app-text">Level not found</h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-6 text-app-muted">
          This level isn’t part of the current assessment. Choose A1, A2, B1 or B2
          to continue.
        </p>
        <Link
          href="/courses"
          className="focus-ring mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-app-accent px-5 text-sm font-black text-app-on-accent"
        >
          Back to Courses
        </Link>
      </div>
    </div>
  );
}
