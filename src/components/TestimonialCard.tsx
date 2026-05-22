import type { Testimonial } from "@/types";

type TestimonialCardProps = {
  testimonial: Testimonial;
};

export function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <article className="surface rounded-3xl p-6">
      <p className="text-base leading-7 text-slate-700">&quot;{testimonial.quote}&quot;</p>
      <div className="mt-6 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-[#0a1224] text-sm font-black text-[#ffce45]">
          {testimonial.name.slice(0, 2)}
        </div>
        <div>
          <p className="font-black text-[#0a1224]">{testimonial.name}</p>
          <p className="text-sm text-slate-500">{testimonial.role}</p>
        </div>
      </div>
    </article>
  );
}
