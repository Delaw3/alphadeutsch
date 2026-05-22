"use client";

import { useEffect, useState } from "react";
import { galleryItems } from "@/data/gallery";

export function GalleryScatter() {
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
      <div className="gallery-scatter mt-12 grid grid-cols-2 gap-3 px-2 sm:gap-5 md:grid-cols-2 lg:min-h-[520px] lg:grid-cols-12 lg:px-0">
        {galleryItems.slice(0, 4).map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`gallery-polaroid group relative overflow-hidden rounded-[24px] border border-white/60 bg-white p-1.5 text-left shadow-2xl shadow-slate-950/12 transition duration-500 hover:z-10 hover:-translate-y-3 hover:rotate-0 hover:scale-[1.03] active:scale-[0.98] sm:rounded-[28px] sm:p-2 ${
              index === 0
                ? "translate-y-4 rotate-[-4deg] lg:col-span-5 lg:row-span-2 lg:translate-y-0 lg:rotate-[-3deg]"
                : index === 1
                  ? "-translate-y-2 rotate-[3deg] lg:col-span-4 lg:translate-y-10 lg:rotate-[2deg]"
                  : index === 2
                    ? "translate-y-1 rotate-[5deg] lg:col-span-3 lg:-translate-y-4 lg:rotate-[4deg]"
                    : "-translate-y-5 rotate-[-3deg] lg:col-span-5 lg:col-start-7 lg:-translate-y-16 lg:rotate-[-2deg]"
            }`}
            aria-label={`Open ${item.title}`}
          >
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[19px] sm:rounded-[22px]">
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
              className="focus-ring absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-xl font-black text-[#0a1224] shadow-lg transition hover:bg-white"
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
