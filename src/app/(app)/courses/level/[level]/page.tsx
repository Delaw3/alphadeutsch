import { notFound } from "next/navigation";

import { LevelAssessmentScreen } from "@/components/mobile/LevelAssessment";
import { isLevelId } from "@/lib/assessment/config";

/**
 * Route shell for `/courses/level/[level]`.
 *
 * Server component: it awaits the route params and hands the level id to the
 * client assessment screen. Because the page itself is not a client component,
 * `next build` prerenders the assessment markup into the static HTML — which the
 * Capacitor bundle ships — so the screen paints immediately inside the WebView
 * instead of flashing an empty shell while React hydrates.
 *
 * The four level params come from `layout.tsx` (`generateStaticParams`). Any
 * other value (a removed level such as `c1`, or a stale/hand-typed URL) calls
 * `notFound()`, which renders the segment's friendly `not-found.tsx`. That stays
 * static-export compatible: inside the Android WebView Capacitor serves
 * `index.html` for extension-less paths (html5mode), the client router resolves
 * the URL, and this boundary renders the "Level not found" screen with a way
 * back — no server dependency involved.
 */
export default async function LevelAssessmentPage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level } = await params;
  if (!isLevelId(level)) notFound();
  return <LevelAssessmentScreen level={level} />;
}
