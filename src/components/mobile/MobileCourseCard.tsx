import Link from "next/link";
import { formatNaira, type MobileCourseRow } from "@/lib/mobile-api";

function shortDescription(value: string): string {
  const plain = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= 130) return plain;
  return `${plain.slice(0, 130).trim()}…`;
}

export function MobileCourseCard({ course }: { course: MobileCourseRow }) {
  const closed = course.is_open !== 1;
  return (
    <article className="rounded-3xl border border-app-border bg-app-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-app-muted">
            {course.display}
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-app-text">{course.title}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-app-border bg-app-surface-2 px-3 py-1.5 text-[13px] font-black tabular-nums text-app-text">
          {formatNaira(course.price)}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-app-muted">{shortDescription(course.description)}</p>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/courses/${course.id}`}
          className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-app-accent px-4 text-sm font-black text-app-on-accent transition active:scale-[0.98]"
        >
          View details
        </Link>
        {closed ? (
          <span className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-surface-2 px-4 text-xs font-black text-app-muted">
            Closed
          </span>
        ) : (
          <span className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-app-border bg-app-surface-2 px-4 text-xs font-black text-app-text">
            Open
          </span>
        )}
      </div>
    </article>
  );
}
