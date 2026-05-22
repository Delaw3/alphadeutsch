import type { Metadata } from "next";
import { CTASection } from "@/components/CTASection";
import { SectionHeader } from "@/components/SectionHeader";

const posts = [
  {
    title: "How to choose your German course level",
    category: "Learn German",
    excerpt: "A simple guide to understanding A1, A2, B1, B2, and C1 before starting your Alpha Deutsch journey.",
  },
  {
    title: "Preparing for study opportunities in Germany",
    category: "Study in Germany",
    excerpt: "What students should organize early when connecting German learning with admissions and travel plans.",
  },
  {
    title: "Why private tutorials help busy learners",
    category: "Private Tutorial",
    excerpt: "How personalized lessons can support students who need flexible learning around work, school, or family schedules.",
  },
];

export const metadata: Metadata = {
  title: "Blog",
  description: "Read Alpha Deutsch updates about German learning, study in Germany, admissions, and student preparation.",
};

export default function BlogPage() {
  return (
    <>
      <section className="container-shell py-20">
        <SectionHeader
          eyebrow="Our Blog"
          title="German learning, study guidance, and Alpha Deutsch updates"
          description="Helpful notes for German learners, students planning Germany pathways, and families preparing for language success."
        />
        {/* Future NestJS integration: replace static posts with CMS/blog API content. */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {posts.map((post) => (
            <article key={post.title} className="surface rounded-3xl p-6">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#dd1f2d]">{post.category}</p>
              <h2 className="mt-4 text-xl font-black text-[#0a1224]">{post.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
            </article>
          ))}
        </div>
      </section>
      <CTASection title="Start with the right German level." description="Explore Alpha Deutsch courses or contact the team for guidance before registration." />
    </>
  );
}
