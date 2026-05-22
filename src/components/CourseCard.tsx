import type { Course } from "@/types";
import { ButtonLink } from "@/components/ui/ButtonLink";

type CourseCardProps = {
  course: Course;
};

export function CourseCard({ course }: CourseCardProps) {
  return (
    <article className="surface flex h-full flex-col rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#dd1f2d]">Level {course.level}</p>
          <h3 className="mt-2 text-2xl font-black text-[#0a1224]">{course.title}</h3>
        </div>
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#0a1224] text-xl font-black text-white">
          {course.level}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{course.description}</p>

      <div className="mt-6 grid gap-3 border-y border-slate-100 py-5">
        {course.prices.map((item) => (
          <div key={item.mode} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-black text-[#0a1224]">{item.mode}</span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#dd1f2d] shadow-sm">
                {item.price}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.duration}</p>
          </div>
        ))}
      </div>

      <ul className="mt-5 grid gap-2 text-sm text-slate-600">
        {course.outcomes.map((outcome) => (
          <li key={outcome} className="flex gap-2">
            <span className="mt-1.5 size-2 rounded-full bg-[#ffce45]" />
            <span>{outcome}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <ButtonLink href="/contact">Register Interest</ButtonLink>
      </div>
    </article>
  );
}
