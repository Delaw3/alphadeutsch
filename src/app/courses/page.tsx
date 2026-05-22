import type { Metadata } from "next";
import { CourseCard } from "@/components/CourseCard";
import { CTASection } from "@/components/CTASection";
import { SectionHeader } from "@/components/SectionHeader";
import { courses } from "@/data/courses";
import { courseProcess } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Courses",
  description: "Explore Alpha Deutsch German courses from A1 to C1 plus Family Reunion preparation.",
};

export default function CoursesPage() {
  return (
    <>
      <section className="container-shell py-20">
        <SectionHeader
          eyebrow="Courses"
          title="Choose your German level and learning mode"
          description="Each course groups the real Alpha Deutsch learning modes and prices in one clean card: On-Site, Online, Private, and Online Private."
        />
        {/* Future NestJS integration: fetch live course catalog, pricing, cohorts, and enrollment availability here. */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.level} course={course} />
          ))}
        </div>
      </section>
      <section className="bg-white py-20">
        <div className="container-shell">
          <SectionHeader
            eyebrow="Course duration"
            title="On-site sessions are structured, online and private learning is flexible"
            description="On-site courses run for 9 weeks and 144 hours, with Morning, Afternoon, and Evening sessions. Online and private courses are individually determined and adapted to the student's schedule."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {courseProcess.map((step, index) => (
              <article key={step} className="surface rounded-3xl p-6">
                <p className="text-sm font-black text-[#dd1f2d]">0{index + 1}</p>
                <h3 className="mt-4 text-lg font-black text-[#0a1224]">{step}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>
      <CTASection title="Need help choosing a level?" description="Contact Alpha Deutsch for a placement conversation and a study route that fits your goals." />
    </>
  );
}
