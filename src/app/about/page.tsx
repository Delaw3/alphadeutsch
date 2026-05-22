import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";
import { SectionHeader } from "@/components/SectionHeader";
import { brandCopy, stats } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Alpha Deutsch, a Nigerian-based German language and culture learning center in Awka.",
};

export default function AboutPage() {
  return (
    <>
      <section className="container-shell grid gap-10 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <SectionHeader
          eyebrow="About Alpha Deutsch"
          title="A Nigerian-based German language and culture learning center"
          description={brandCopy.about}
        />
        <div className="surface rounded-[32px] p-8">
          <div className="flag-strip mb-8 h-2 rounded-full" />
          <p className="text-2xl font-black leading-tight text-[#0a1224]">
            Alpha Deutsch promotes knowledge of the German language in Nigeria and fosters international cultural cooperation.
          </p>
          <p className="mt-5 leading-7 text-slate-600">
            Students learn with highly qualified teachers, modern teaching methods, intensive support, and internationally recognized course levels from A1 to C1.
          </p>
        </div>
      </section>
      <section className="bg-white py-20">
        <div className="container-shell grid gap-5 md:grid-cols-3">
          {[
            ["Learn German", "Level-based German learning from A1 to C1."],
            ["Cultural cooperation", "A learning center built around German language and culture."],
            ["Future-ready", "Prepared for result portal, admissions, visa, and student workflows later."],
          ].map(([title, body]) => (
            <article key={title} className="surface rounded-3xl p-6">
              <h3 className="text-xl font-black text-[#0a1224]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container-shell py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {stats.map((item) => (
            <article key={item.label} className="surface rounded-3xl p-6">
              <p className="text-4xl font-black text-[#dd1f2d]">{item.value}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            </article>
          ))}
        </div>
      </section>
      <CTASection />
    </>
  );
}
