"use client";

import { useEffect, useState } from "react";
import { TestimonialCard } from "@/components/TestimonialCard";
import type { Testimonial } from "@/types";

type TestimonialsCarouselProps = {
  testimonials: Testimonial[];
};

export function TestimonialsCarousel({ testimonials }: TestimonialsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (testimonials.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [testimonials.length]);

  function goToPrevious() {
    setActiveIndex((current) => (current - 1 + testimonials.length) % testimonials.length);
  }

  function goToNext() {
    setActiveIndex((current) => (current + 1) % testimonials.length);
  }

  return (
    <div className="relative mt-10 overflow-hidden rounded-[32px]">
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {testimonials.map((testimonial) => (
          <div key={testimonial.name} className="min-w-full px-1 sm:px-2">
            <TestimonialCard testimonial={testimonial} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2" aria-label="Testimonial carousel controls">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.name}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === activeIndex ? "w-10 bg-[#ffce45]" : "w-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Show testimonial ${index + 1}`}
              aria-current={index === activeIndex}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goToPrevious}
            className="focus-ring grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-sm font-black text-[#0a1224] shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            aria-label="Previous testimonial"
          >
            &lt;
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="focus-ring grid size-11 place-items-center rounded-full bg-[#ffce45] text-sm font-black text-black shadow-lg shadow-yellow-900/15 transition hover:-translate-y-0.5 hover:bg-[#f3bd22]"
            aria-label="Next testimonial"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
