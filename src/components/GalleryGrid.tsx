"use client";

import { useEffect, useState } from "react";
import { galleryItems } from "@/data/gallery";

export function GalleryGrid() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : galleryItems[activeIndex];

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeIndex]);

  return (
    <>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {galleryItems.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`surface group overflow-hidden rounded-[32px] text-left transition duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-950/14 active:scale-[0.99] ${
              index % 3 === 0 ? "md:row-span-2" : ""
            }`}
            aria-label={`Open ${item.title}`}
          >
            <span className={index % 3 === 0 ? "relative block aspect-[4/5] overflow-hidden" : "relative block aspect-[16/11] overflow-hidden"}>
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </span>
          </button>
        ))}
      </div>

      {activeItem ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[#0a1224]/88 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.title}
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[28px] bg-white p-2 shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="focus-ring absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-base font-black text-[#0a1224] shadow-lg transition hover:bg-white"
              aria-label="Close gallery image"
            >
              X
            </button>
            <img src={activeItem.image} alt={activeItem.title} className="max-h-[82vh] w-full rounded-[22px] object-contain" />
          </div>
        </div>
      ) : null}
    </>
  );
}
