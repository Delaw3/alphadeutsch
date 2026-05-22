"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
};

export function Reveal({ children, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    setIsReady(true);

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const rect = node.getBoundingClientRect();

    if (rect.top < window.innerHeight * 1.05) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px 18% 0px", threshold: 0.01 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-section ${isReady ? "is-ready" : ""} ${isVisible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
