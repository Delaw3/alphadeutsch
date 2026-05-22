import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";
import { GalleryGrid } from "@/components/GalleryGrid";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Explore featured Alpha Deutsch gallery moments from classes, students, culture, and study pathway activities.",
};

export default function GalleryPage() {
  return (
    <>
      <section className="container-shell py-20">
        <SectionHeader
          align="center"
          eyebrow="Gallery"
          title="Moments from Alpha Deutsch"
          description="Explore classroom moments, student stories, cultural activities, and study pathway highlights from Alpha Deutsch."
        />
        {/* Future NestJS integration: fetch gallery albums and media records from backend-managed storage. */}
        <GalleryGrid />
      </section>
      <CTASection title="Want to be part of the next Alpha Deutsch story?" description="Start with a German course, then build your pathway toward language confidence and opportunities in Germany." />
    </>
  );
}
