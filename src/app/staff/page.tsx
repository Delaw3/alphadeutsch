import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";
import { SectionHeader } from "@/components/SectionHeader";
import { staff } from "@/data/staff";

export const metadata: Metadata = {
  title: "Staff",
  description: "Meet the Alpha Deutsch staff team across administration, academics, ICT, media, protocol, and liaison roles.",
};

export default function StaffPage() {
  return (
    <>
      <section className="container-shell py-20">
        <SectionHeader
          eyebrow="Staff"
          title="Meet the Alpha Deutsch team"
          description="The institute brings together leadership, administration, academics, media, ICT, protocol, and international liaison support."
        />
        {/* Future NestJS integration: replace static staff records with CMS/admin-managed staff profiles and images. */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <article key={member.name} className="surface rounded-3xl p-6">
              <div className="grid size-14 place-items-center rounded-2xl bg-[#0a1224] text-lg font-black text-[#ffce45]">
                {member.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </div>
              <h2 className="mt-5 text-xl font-black text-[#0a1224]">{member.name}</h2>
              <p className="mt-2 text-sm font-bold text-[#dd1f2d]">{member.role}</p>
            </article>
          ))}
        </div>
      </section>
      <CTASection title="Learn with a real team behind you." description="Alpha Deutsch combines qualified teachers, administrative support, and student-focused guidance for German language and Germany pathway goals." />
    </>
  );
}
