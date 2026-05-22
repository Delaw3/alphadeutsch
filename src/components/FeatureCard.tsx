import type { Feature } from "@/types";

type FeatureCardProps = {
  feature: Feature;
};

export function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <article className="surface rounded-3xl p-6">
      <p className="text-sm font-black text-[#dd1f2d]">{feature.eyebrow}</p>
      <h3 className="mt-4 text-xl font-black text-[#0a1224]">{feature.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
    </article>
  );
}
