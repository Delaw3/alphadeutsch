import type { FAQ } from "@/types";

type FAQAccordionProps = {
  faqs: FAQ[];
};

export function FAQAccordion({ faqs }: FAQAccordionProps) {
  return (
    <div className="grid gap-3">
      {faqs.map((faq) => (
        <details key={faq.question} className="surface group rounded-2xl p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-black text-[#0a1224]">
            {faq.question}
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-lg transition group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-4 text-sm leading-6 text-slate-600">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
