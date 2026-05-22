import Link from "next/link";
import { CourseCard } from "@/components/CourseCard";
import { CTASection } from "@/components/CTASection";
import { FAQAccordion } from "@/components/FAQAccordion";
import { GalleryScatter } from "@/components/GalleryScatter";
import { HomeLoader } from "@/components/HomeLoader";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { courses } from "@/data/courses";
import { faqs } from "@/data/faqs";
import { features } from "@/data/features";
import { testimonials } from "@/data/testimonials";
import { brandCopy, courseProcess } from "@/lib/constants";

const advancedFeatures = [
  {
    title: "Find Admissions",
    icon: "home",
    description:
      "Alpha Deutsch guides ready students through admission pathways, helping them understand the documents and next steps needed for Germany-focused study plans.",
    href: "/courses",
    action: "Enrol Now",
  },
  {
    title: "Visa Application",
    icon: "thumb",
    description:
      "Get organized for visa preparation with practical guidance around requirements, application steps, and the documents students need to follow up carefully.",
    href: "/contact",
    action: "Contact",
  },
  {
    title: "Private Tutorial",
    icon: "group",
    description:
      "Private German sessions are adapted to your personal schedule, learning pace, exam goals, and the support you need to make steady progress.",
    href: "/courses",
    action: "Enrol Now",
  },
  {
    title: "Online Classes",
    icon: "class",
    description:
      "Online classes support reading, listening, writing, and speaking for students who need flexible German learning without losing lesson quality.",
    href: "/courses",
    action: "Enrol Now",
  },
];

const culturalIllustrations = [
  { icon: "gate", className: "left-[6%] top-12 rotate-[-8deg] text-[#dd1f2d]" },
  { icon: "book", className: "right-[7%] top-24 rotate-[10deg] text-[#ff9f0a]" },
  { icon: "globe", className: "left-[12%] bottom-16 rotate-[7deg] text-[#0a1224]" },
  { icon: "flag", className: "right-[10%] bottom-10 rotate-[-10deg] text-[#dd1f2d]" },
  { icon: "speech", className: "left-[46%] top-10 rotate-[5deg] text-[#ff9f0a]" },
];

function AdvancedFeatureIcon({ icon }: { icon: string }) {
  const paths = {
    home: (
      <>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V19h11v-8.5" />
        <path d="M10 19v-5h4v5" />
      </>
    ),
    thumb: (
      <>
        <path d="M8 11v9H4v-9h4Z" />
        <path d="M8 11l4.5-7c1.4.3 2 1.5 1.6 3l-.7 2.5H19c1.2 0 2 .9 1.8 2.1l-1.1 6.3c-.2 1.2-1.2 2.1-2.4 2.1H8" />
      </>
    ),
    group: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3.5 19c.7-3.3 2.6-5 5.5-5s4.8 1.7 5.5 5" />
        <path d="M14.5 15c2.4.2 4 1.6 4.8 4" />
      </>
    ),
    class: (
      <>
        <path d="M6 5h12v14H6z" />
        <path d="M9 9h6M9 13h6M9 17h3" />
        <path d="M4 8h2M18 8h2M4 16h2M18 16h2" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-none stroke-current stroke-2">
      {paths[icon as keyof typeof paths]}
    </svg>
  );
}

function CulturalIllustrationIcon({ icon }: { icon: string }) {
  const paths = {
    gate: (
      <>
        <path d="M4 20h16" />
        <path d="M6 20V9h12v11" />
        <path d="M4 9h16L12 4 4 9Z" />
        <path d="M9 20v-7M12 20v-7M15 20v-7" />
      </>
    ),
    book: (
      <>
        <path d="M5 5.5c2.8 0 4.8.6 7 2v12c-2.2-1.4-4.2-2-7-2V5.5Z" />
        <path d="M19 5.5c-2.8 0-4.8.6-7 2v12c2.2-1.4 4.2-2 7-2V5.5Z" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4c2.2 2.5 3.2 5.2 3.2 8S14.2 17.5 12 20" />
        <path d="M12 4c-2.2 2.5-3.2 5.2-3.2 8S9.8 17.5 12 20" />
      </>
    ),
    flag: (
      <>
        <path d="M6 21V4" />
        <path d="M6 5h12v9H6" />
        <path d="M6 8h12M6 11h12" />
      </>
    ),
    speech: (
      <>
        <path d="M5 6.5h14v9H9l-4 3v-12Z" />
        <path d="M9 10h6M9 13h4" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-20 fill-none stroke-current stroke-[1.6]">
      {paths[icon as keyof typeof paths]}
    </svg>
  );
}

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
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,206,69,0.28),transparent_24rem),radial-gradient(circle_at_86%_24%,rgba(221,31,45,0.2),transparent_26rem),linear-gradient(135deg,#071022_0%,#101827_48%,#18202f_100%)]" />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {culturalIllustrations.map((item) => (
              <span
                key={`${item.icon}-${item.className}`}
                className={`absolute grid size-28 place-items-center rounded-[28px] border border-white/15 bg-white/10 opacity-[0.22] shadow-2xl shadow-black/20 backdrop-blur-sm ${item.className}`}
              >
                <CulturalIllustrationIcon icon={item.icon} />
              </span>
            ))}
            <span className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffce45]/20 blur-3xl" />
          </div>
          <div className="container-shell relative z-10">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
              <div>
                <p className="text-lg font-black uppercase tracking-[0.18em] text-[#ffce45] md:text-xl">Why choose us</p>
                <h2 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
                  Highly qualified teachers, modern methods, intensive support
                </h2>
                <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">{brandCopy.about}</p>
                <div className="mt-8 h-2 w-40 rounded-full flag-strip" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {features.map((feature) => (
                  <article
                    key={feature.title}
                    className="rounded-[28px] border border-white/12 bg-white/9 p-6 text-white shadow-2xl shadow-black/20 backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/12"
                  >
                    <p className="text-sm font-black text-[#ffce45]">{feature.eyebrow}</p>
                    <h3 className="mt-4 text-xl font-black">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{feature.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="relative overflow-hidden py-20">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{
              backgroundImage:
                "url(https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/Images/0.png)",
            }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white via-white/92 to-[#fff3c8]/82" aria-hidden="true" />
          <div className="container-shell relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-black tracking-tight text-[#ff9f0a] md:text-5xl">Advance Features!</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-700">
                He who knows no foreign languages knows nothing of his own, and the limits of my language mean the limits
                of my world.
              </p>
            </div>

            <div className="mx-auto mt-14 grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-14">
              {advancedFeatures.map((feature) => (
                <article key={feature.title} className="grid grid-cols-[56px_1fr] items-start gap-5">
                  <div className="grid size-14 place-items-center rounded-md bg-[#ff9f0a] text-white shadow-lg shadow-orange-500/20">
                    <AdvancedFeatureIcon icon={feature.icon} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#0a1224]">{feature.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-700">{feature.description}</p>
                    <Link
                      href={feature.href}
                      className="advanced-feature-link focus-ring mt-5 inline-flex text-sm font-black underline decoration-2 underline-offset-4 transition"
                      style={{ color: "#ff9f0a" }}
                    >
                      {feature.action}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
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
              title="Alpha Deutsch life"
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
          <TestimonialsCarousel testimonials={testimonials} />
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
