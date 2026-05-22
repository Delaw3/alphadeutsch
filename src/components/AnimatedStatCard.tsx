"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedStatCardProps = {
  value: string;
  label: string;
  variant?: "hero" | "surface";
};

function parseStat(value: string) {
  const match = value.match(/^(\d+)(.*)$/);

  if (!match) {
    return { number: 0, suffix: value };
  }

  return {
    number: Number(match[1]),
    suffix: match[2] ?? "",
  };
}

export function AnimatedStatCard({ value, label, variant = "surface" }: AnimatedStatCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const { number, suffix } = parseStat(value);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const startCounter = () => setHasStarted(true);

    const waitForHomeLoader = () => {
      if (variant !== "hero" || !document.querySelector("[data-home-loader='true']")) {
        startCounter();
        return;
      }

      window.addEventListener("alpha-deutsch-home-loader-complete", startCounter, { once: true });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          waitForHomeLoader();
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: variant === "hero" ? 0.1 : 0.45 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.removeEventListener("alpha-deutsch-home-loader-complete", startCounter);
    };
  }, [variant]);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    const duration = 1200;
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(number * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [hasStarted, number]);

  const classes =
    variant === "hero"
      ? "rounded-3xl border border-white/10 bg-white/8 px-3 py-4 backdrop-blur-sm sm:p-4"
      : "surface rounded-3xl p-6 text-center";

  return (
    <div ref={ref} className={classes}>
      <p className={variant === "hero" ? "text-xl font-black text-[#ffce45] sm:text-2xl" : "text-4xl font-black text-[#dd1f2d]"}>
        {displayValue}
        {suffix}
      </p>
      <p
        className={
          variant === "hero"
            ? "mt-1 text-[0.62rem] font-black uppercase leading-4 tracking-[0.08em] text-slate-200 sm:text-xs sm:tracking-[0.12em]"
            : "mt-2 text-sm font-black uppercase tracking-[0.14em] text-slate-500"
        }
      >
        {label}
      </p>
    </div>
  );
}
