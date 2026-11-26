import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { MobileScreen } from "@/components/mobile/MobileScreen";
import { ASSESSMENTS, LEVELS, type LevelId } from "@/lib/assessment/config";

/**
 * Student-facing Courses page.
 *
 * Presents the six CEFR levels with a placement assessment entry point. The
 * database-backed course catalogue (prices, modes, per-course detail pages and
 * `/api/courses`) is intentionally NOT shown here any more — those records and
 * endpoints are untouched and remain available for future use (e.g. the AppTopBar
 * search and the `/courses/[id]` detail route still work).
 */

/**
 * Each level gets its own quiet accent so the list is scannable at a glance
 * without adding extra chrome or badges.
 */
const LEVEL_THEME: Record<LevelId, { chip: string; arrow: string }> = {
  a1: {
    chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
    arrow: "text-emerald-600/70 dark:text-emerald-400/70",
  },
  a2: {
    chip: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400",
    arrow: "text-sky-600/70 dark:text-sky-400/70",
  },
  b1: {
    chip: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400",
    arrow: "text-violet-600/70 dark:text-violet-400/70",
  },
  b2: {
    chip: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400",
    arrow: "text-amber-600/70 dark:text-amber-400/70",
  },
};

export default function LevelsPage() {
  return (
    <MobileScreen
      title="Choose your level"
      description="Start a short assessment for the German level you want to register for."
    >
      {/* Flex column: each card is an independent row, and nothing here can
          contribute a min-content width wider than the screen. */}
      <div className="flex flex-col gap-2.5">
        {LEVELS.map((level) => {
          const active = ASSESSMENTS[level.id].active;
          const theme = LEVEL_THEME[level.id];

          const content = (
            <>
              <span
                aria-hidden="true"
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-[13px] font-black ring-1 ${theme.chip}`}
              >
                {level.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black leading-tight text-app-text">
                  {level.name}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-[12px] leading-5 text-app-muted">
                  {level.tagline}
                </span>
              </span>
              {active ? (
                <ChevronRight className={`size-5 shrink-0 ${theme.arrow}`} aria-hidden="true" />
              ) : (
                <span className="shrink-0 text-[11px] font-bold text-app-muted">Soon</span>
              )}
            </>
          );

          const card =
            "flex min-w-0 items-center gap-3.5 rounded-2xl border border-app-border bg-app-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

          if (!active) {
            return (
              <div key={level.id} aria-disabled="true" className={`${card} opacity-60`}>
                {content}
              </div>
            );
          }

          return (
            <Link
              key={level.id}
              href={`/courses/level/${level.id}`}
              className={`${card} focus-ring transition active:scale-[0.995]`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </MobileScreen>
  );
}
