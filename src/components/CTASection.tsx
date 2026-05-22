import { ButtonLink } from "@/components/ui/ButtonLink";

type CTASectionProps = {
  title?: string;
  description?: string;
};

export function CTASection({
  title = "Your future in Germany could start here.",
  description = "Choose a course, complete registration and payment, then come in for classes or receive confirmation for online/private learning.",
}: CTASectionProps) {
  return (
    <section className="container-shell">
      <div className="dark-surface overflow-hidden rounded-[32px]">
        <div className="flag-strip h-2" />
        <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center lg:p-10">
          <div>
            <h2 className="text-3xl font-black tracking-normal sm:text-4xl">{title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <ButtonLink href="/courses" variant="secondary">
              View Courses
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghost">
              Contact Us
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
