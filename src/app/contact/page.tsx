import type { Metadata } from "next";
import { SectionHeader } from "@/components/SectionHeader";
import { siteConfig } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Alpha Deutsch to ask about German courses, study pathways, and enrollment options.",
};

export default function ContactPage() {
  return (
    <section className="container-shell grid gap-10 py-20 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <SectionHeader
          eyebrow="Contact"
          title="Contact Alpha Deutsch in Awka"
          description="Reach the team for German courses, online classes, private tutorial, study in Germany guidance, admissions support, or visa application preparation."
        />
        <div className="mt-8 grid gap-4 text-sm text-slate-700">
          <p>
            <strong className="text-[#0a1224]">Email:</strong> {siteConfig.email}
          </p>
          <p>
            <strong className="text-[#0a1224]">Email 2:</strong> {siteConfig.emailAlt}
          </p>
          <p>
            <strong className="text-[#0a1224]">Phone:</strong> {siteConfig.phone}
          </p>
          <p>
            <strong className="text-[#0a1224]">Phone 2:</strong> {siteConfig.phoneAlt}
          </p>
          <p>
            <strong className="text-[#0a1224]">Address:</strong> {siteConfig.address}
          </p>
        </div>
      </div>
      <form className="surface rounded-[32px] p-6 md:p-8">
        {/* Future NestJS integration: submit lead data to a contact/enquiry endpoint with validation and anti-spam controls. */}
        <div className="grid gap-5">
          {[
            ["Full name", "Enter your name"],
            ["Email address", "you@example.com"],
            ["Phone number", "+234"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-2 text-sm font-bold text-[#0a1224]">
              {label}
              <input
                className="focus-ring min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900"
                placeholder={placeholder}
              />
            </label>
          ))}
          <label className="grid gap-2 text-sm font-bold text-[#0a1224]">
            Message
            <textarea
              className="focus-ring min-h-36 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              placeholder="Tell us your current German level and your goal."
            />
          </label>
          <button
            type="button"
            className="focus-ring min-h-12 rounded-full bg-[#dd1f2d] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:bg-[#c81724]"
          >
            Send Preview Message
          </button>
        </div>
      </form>
    </section>
  );
}
