import type { Metadata } from "next";
import { PortalPreview } from "@/components/PortalPreview";

export const metadata: Metadata = {
  title: "Result Portal",
  description: "Access Alpha Deutsch student results by entering your registration number, course, date of birth, and exam sitting.",
};

export default function StudentPortalPage() {
  return (
    <section className="container-shell py-20">
      {/* Future NestJS integration: validate form details and return student result records from the backend. */}
      <PortalPreview />
    </section>
  );
}
