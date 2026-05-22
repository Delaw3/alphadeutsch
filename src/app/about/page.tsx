import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";
import { galleryItems } from "@/data/gallery";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Alpha Deutsch Institut, a German language and culture learning center in Awka, Anambra State.",
};

const values = ["Fidelity", "Resilience", "Service", "Family"];

export default function AboutPage() {
  const aboutImage = galleryItems[0].image;

  return (
    <>
      <section className="container-shell grid gap-10 py-16 lg:grid-cols-[1fr_0.72fr] lg:items-start lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#dd1f2d]">About Alpha Deutsch</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-[#0a1224] md:text-5xl">Why Choose Us?</h1>

          <div className="mt-7 space-y-5 text-base leading-8 text-slate-700">
            <p>
              Alpha Deutsch is a Nigerian-based German language and Culture learning center. We promote knowledge of the
              German language in Nigeria and foster international cultural cooperation.
            </p>
            <p className="font-semibold uppercase tracking-[0.03em] text-[#0a1224]">
              Your future at Germany could start here. He who knows no foreign languages knows nothing of his own, and
              the limits of my language mean the limits of my world.
            </p>
          </div>

          <h2 className="mt-10 max-w-2xl text-4xl font-black tracking-tight text-[#0a1224] md:text-5xl">
            Everything You Need To Know About Alpha Deutsch
          </h2>

          <div className="mt-7 space-y-6 text-base leading-8 text-slate-700">
            <p>
              <strong className="text-[#0a1224]">Alpha Deutsch Institut:</strong> The Alpha Deutsch Institut is the
              number one German Language Learning Centre in Awka, Anambra State, specialising in teaching the German
              Language across all levels for interested candidates.
            </p>
            <p>
              We promote knowledge of the German language abroad and foster international cultural cooperation. We convey
              a comprehensive image of Germany by providing information about cultural, social, and political life in our
              nation. Our cultural and educational programs encourage intercultural dialogue and enable cultural
              involvement. They strengthen the development of structures in civil society and foster worldwide mobility.
            </p>
            <p>
              With our extreme desire for a sound knowledge of the German language, our experienced teachers, and with
              our relationship with other foreign institutes, we have recorded very high success stories both in acquiring
              excellent results in various exams and migration to Germany and other German-speaking countries.
            </p>
            <p>
              Our long-lasting partnerships with great institutions and individuals in both Nigeria and Germany create
              enduring trust. We are partners for all who actively engage with Germany and its culture, working
              independently and without political ties.
            </p>
            <p>More than 200 candidates attend the intensive German course every year and take part in widely recognized examinations.</p>
          </div>
        </div>

        <div className="lg:sticky lg:top-28">
          <div className="surface overflow-hidden rounded-[32px] p-3">
            <img
              src={aboutImage}
              alt="Alpha Deutsch students learning German"
              className="aspect-[4/3] w-full rounded-[24px] object-cover"
            />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["5+", "Years Experience"],
              ["10+", "Staff"],
              ["200+", "Stories"],
            ].map(([value, label]) => (
              <div key={label} className="dark-surface rounded-3xl p-4 text-center">
                <p className="text-2xl font-black text-[#ffce45]">{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/75">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="overflow-hidden rounded-[32px] shadow-2xl shadow-slate-900/10">
            <img
              src={aboutImage}
              alt="Alpha Deutsch classroom support"
              className="aspect-[16/10] w-full object-cover"
            />
          </div>

          <div className="max-w-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#dd1f2d]">Our mission</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-[#0a1224] md:text-5xl">Our Mission.</h2>
            <p className="mt-6 leading-7 text-slate-600">Our key value</p>
            <div className="mt-6 grid gap-4">
              {values.map((value) => (
                <div key={value} className="flex items-center gap-3 text-lg font-semibold text-slate-700">
                  <span className="grid size-6 place-items-center rounded-full bg-[#dd1f2d]/10 text-sm font-black text-[#dd1f2d]">
                    ✓
                  </span>
                  {value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-shell grid gap-5 py-16 md:grid-cols-2 lg:py-20">
        <article className="surface rounded-[32px] p-7">
          <h2 className="text-2xl font-black text-[#0a1224]">Online Class</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Our online courses are conducted over the Internet. The classes are generally conducted through meeting
            management systems like Zoom or Skype. Students can view their course syllabus and academic progress, as well
            as communicate with fellow students and their course instructor.
          </p>
        </article>
        <article className="surface rounded-[32px] p-7">
          <h2 className="text-2xl font-black text-[#0a1224]">Advantages Of Our Online-Course</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Online courses at Alpha Deutsch are convenient and flexible. We bring German language right to your home.
          </p>
        </article>
      </section>

      <CTASection />
    </>
  );
}
