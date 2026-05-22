import Link from "next/link";
import { CourseCard } from "@/components/CourseCard";
import { CTASection } from "@/components/CTASection";
import { FAQAccordion } from "@/components/FAQAccordion";
import { FeatureCard } from "@/components/FeatureCard";
import { GalleryScatter } from "@/components/GalleryScatter";
import { HomeLoader } from "@/components/HomeLoader";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { TestimonialCard } from "@/components/TestimonialCard";
import { courses } from "@/data/courses";
import { faqs } from "@/data/faqs";
import { features } from "@/data/features";
import { testimonials } from "@/data/testimonials";
import { websiteSections } from "@/data/website-sections";
import { brandCopy, courseProcess } from "@/lib/constants";

export default function Home() {
  return (
    <>
      <HomeLoader />
      <Hero />

      <Reveal>
        <section className="container-shell py-20">
          <SectionHeader
            eyebrow="Course levels"
            title="Learn German from A1 to C1 with flexible class options"
            description="Courses are grouped by level and learning mode, so students can compare on-site, online, private, and online private options clearly."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.level} course={course} />
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="bg-white py-20">
          <div className="container-shell">
            <SectionHeader
              eyebrow="Why choose us"
              title="Highly qualified teachers, modern methods, intensive support"
              description={brandCopy.about}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="container-shell grid gap-10 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeader
              eyebrow="Website sections"
              title="More than language classes"
              description="The Alpha Deutsch website presents language learning, admissions guidance, visa application support, private tutorial, online classes, gallery, staff, and result portal preview areas."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {websiteSections.slice(0, 8).map((item) => (
              <article key={item.title} className="surface rounded-3xl p-5">
                <h3 className="text-base font-black text-[#0a1224]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="bg-white py-20">
          <div className="container-shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <SectionHeader
              eyebrow="How enrollment works"
              title="A simple four-step course process"
              description="Start by choosing your German level, complete registration and payment, then join your on-site class or receive confirmation for online and private learning."
            />
            {/* Future NestJS integration: connect registration, payment status, and confirmation workflows here. */}
            <div className="grid gap-4 sm:grid-cols-2">
              {courseProcess.map((item, index) => (
                <div key={item} className="dark-surface rounded-3xl p-6">
                  <p className="text-3xl font-black text-[#ffce45]">0{index + 1}</p>
                  <p className="mt-4 text-lg font-black">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="container-shell py-20">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <SectionHeader
              eyebrow="Gallery"
              title="A scattered glimpse of Alpha Deutsch life"
              description="Featured moments from the learning center, arranged as a preview. Click any image to open the full gallery."
            />
            <div className="hidden justify-end lg:flex">
              <Link
                href="/gallery"
                className="focus-ring rounded-full border border-slate-200 bg-white/70 px-5 py-3 text-sm font-black text-[#0a1224] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Open Gallery
              </Link>
            </div>
          </div>
          {/* Future NestJS integration: replace static galleryItems with backend-managed gallery albums and media records. */}
          <GalleryScatter />
          <div className="mt-8 flex lg:hidden">
            <Link
              href="/gallery"
              className="focus-ring w-full rounded-full bg-[#ffce45] px-5 py-3 text-center text-sm font-black text-black shadow-lg shadow-yellow-900/10"
            >
              Open Gallery
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="container-shell py-20">
          <SectionHeader eyebrow="Testimonials" title="Successful stories from Alpha Deutsch students" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.name} testimonial={testimonial} />
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="container-shell py-20">
          <SectionHeader align="center" eyebrow="FAQ" title="Questions students ask first" />
          <div className="mx-auto mt-10 max-w-3xl">
            <FAQAccordion faqs={faqs} />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <CTASection />
      </Reveal>
    </>
  );
}
