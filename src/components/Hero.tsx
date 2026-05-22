"use client";

import { useEffect, useState } from "react";
import { AnimatedStatCard } from "@/components/AnimatedStatCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { stats } from "@/lib/constants";

const heroSlides = [
  {
    image: "https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/Images/0.png",
    eyebrow: "German language and culture learning center in Nigeria",
    title: "Your Future in Germany Could Start Here",
    description:
      "Learn German with highly qualified teachers, modern teaching methods, intensive support, and internationally recognized course levels from A1 to C1.",
  },
  {
    image: "https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/Images/1.png",
    eyebrow: "Learn German with structure",
    title: "Build Confidence From A1 to C1",
    description:
      "Choose on-site, online, private, or online private classes designed around clear progress, speaking practice, and exam readiness.",
  },
  {
    image: "https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/Images/2.png",
    eyebrow: "Study in Germany pathway",
    title: "Prepare for Language, Admissions, and Visa Steps",
    description:
      "Connect your German learning with practical guidance for admissions, visa application preparation, and your transition toward Germany.",
  },
  {
    image: "https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/Images/3.png",
    eyebrow: "Intensive support for every learner",
    title: "Learn With Teachers Who Care About Your Progress",
    description:
      "Alpha Deutsch combines modern teaching, cultural cooperation, and student support to help learners move forward with clarity.",
  },
];

export function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, []);

  const slide = heroSlides[activeSlide];

  return (
    <section className="relative overflow-hidden bg-[#0a1224] text-white">
      <div className="absolute inset-0">
        {heroSlides.map((item, index) => (
          <img
            key={item.image}
            src={item.image}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out ${
              index === activeSlide ? "scale-100 opacity-45" : "scale-105 opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-[#0a1224]/68" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1224]/80 via-transparent to-[#0a1224]/45" />
      </div>
      <div className="absolute inset-x-0 top-0 h-1 flag-strip" />
      <div className="container-shell relative z-10 flex min-h-[calc(100vh-124px)] items-center justify-center py-12 text-center sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 inline-flex max-w-full rounded-full border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold text-[#ffce45] sm:mb-5 sm:px-4 sm:text-sm">
            {slide.eyebrow}
          </p>
          <h1 className="max-w-4xl text-[2.85rem] font-black leading-[1.03] tracking-normal sm:text-6xl lg:text-7xl">
            {slide.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:mt-6 sm:text-lg sm:leading-8">{slide.description}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:mt-8">
            <ButtonLink href="/courses" variant="secondary">
              Enroll Now
            </ButtonLink>
          </div>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {stats.map((item) => (
              <AnimatedStatCard key={item.label} value={item.value} label={item.label} variant="hero" />
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-3" aria-label="Hero carousel controls">
            {heroSlides.map((item, index) => (
              <button
                key={item.image}
                type="button"
                onClick={() => setActiveSlide(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeSlide ? "w-10 bg-[#ffce45]" : "w-2.5 bg-white/35 hover:bg-white/60"
                }`}
                aria-label={`Show slide ${index + 1}`}
                aria-current={index === activeSlide}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
