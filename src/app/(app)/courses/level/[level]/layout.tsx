import type { ReactNode } from "react";

import { LEVELS } from "@/lib/assessment/config";

/**
 * Static-parameter source for the client-side assessment screen.
 *
 * Same convention as `courses/[id]/layout.tsx`: `page.tsx` is a client component
 * and cannot export `generateStaticParams` itself, so this server layout supplies
 * the params. `output: "export"` then emits one shell per level
 * (`courses/level/a1/index.html`, … ) and the Capacitor bundle ships them all.
 *
 * The list is static and tiny, so every build (web and mobile) prerenders the six
 * levels. Unknown levels still render a "level not found" state via the page.
 */
export async function generateStaticParams() {
  return LEVELS.map((level) => ({ level: level.id }));
}

export default function LevelAssessmentLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
