import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Study in Germany",
  description: "Plan your German language journey around study opportunities in Germany with Alpha Deutsch.",
};

export default function StudyInGermanyPage() {
  return (
    <>
      <section className="container-shell py-20">
        <SectionHeader
          eyebrow="Study in Germany"
          title="Language learning, admissions guidance, and visa preparation"
          description="Alpha Deutsch supports students who want their German learning to connect with academic opportunities and life in Germany."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {[
            ["Learn German", "Build the language foundation needed for internationally recognized levels."],
            ["Find Admissions", "Prepare for school search, document planning, and admission pathways."],
            ["Visa Application", "Get organized for the visa preparation process and required next steps."],
            ["Cultural readiness", "Connect language learning with German culture and international cooperation."],
          ].map(([title, body], index) => (
            <article key={title} className="surface rounded-3xl p-6">
              <p className="text-sm font-black text-[#dd1f2d]">0{index + 1}</p>
              <h3 className="mt-4 text-xl font-black text-[#0a1224]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-white py-20">
        <div className="container-shell dark-surface rounded-[32px] p-8 lg:p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffce45]">Pathway snapshot</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {["German level goal", "Admissions support", "Visa application prep"].map((item) => (
              <div key={item} className="rounded-3xl bg-white/10 p-5">
                <p className="text-xl font-black">{item}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">Static prototype content now, ready for NestJS-backed workflows later.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CTASection />
    </>
  );
}
