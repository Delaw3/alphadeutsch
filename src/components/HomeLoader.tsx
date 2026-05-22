"use client";

import { useEffect, useRef, useState } from "react";

export function HomeLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const hasStartedExit = useRef(false);

  useEffect(() => {
    let exitTimer: number | undefined;
    let removeTimer: number | undefined;

    const startExit = () => {
      if (hasStartedExit.current) {
        return;
      }

      hasStartedExit.current = true;
      exitTimer = window.setTimeout(() => {
        setIsLeaving(true);
        removeTimer = window.setTimeout(() => {
          window.dispatchEvent(new Event("alpha-deutsch-home-loader-complete"));
          setIsVisible(false);
        }, 520);
      }, 760);
    };

    if (document.readyState === "complete") {
      startExit();
    } else {
      window.addEventListener("load", startExit, { once: true });
    }

    const fallbackTimer = window.setTimeout(startExit, 1800);

    return () => {
      window.removeEventListener("load", startExit);
      window.clearTimeout(fallbackTimer);
      if (exitTimer) {
        window.clearTimeout(exitTimer);
      }
      if (removeTimer) {
        window.clearTimeout(removeTimer);
      }
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`home-loader fixed inset-0 z-[100] grid place-items-center text-white transition duration-500 ${
        isLeaving ? "home-loader-exit" : ""
      }`}
      data-home-loader="true"
      role="status"
      aria-live="polite"
      aria-label="Loading Alpha Deutsch home page"
    >
      <div className="w-[min(116px,36vw)]">
        <div className="home-loader-flag aspect-square overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/30">
          <div className="loader-band loader-band-black" />
          <div className="loader-band loader-band-red" />
          <div className="loader-band loader-band-gold" />
        </div>
      </div>
    </div>
  );
}
