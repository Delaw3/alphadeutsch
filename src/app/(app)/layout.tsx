"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { AppTopBar } from "@/components/mobile/AppTopBar";
import { normalizePathname } from "@/lib/routes";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname() ?? "/";
  // The mobile export (`trailingSlash: true`) reports "/home/" rather than
  // "/home", so compare the normalised path. No-op on the web build.
  const routePath = normalizePathname(pathname);
  // Show the shared top bar on the Courses and My Learning screens only.
  const showTopBar =
    routePath === "/home" ||
    routePath === "/courses" ||
    routePath.startsWith("/courses/") ||
    routePath === "/learning" ||
    routePath.startsWith("/learning/");

  // The root layout already renders `.mobile-app-shell`; re-using it here nested
  // a second one on every app screen (double min-height, and it used to double
  // the safe-area padding as well).
  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <main
        className={`mobile-app-main pb-[calc(6.5rem+env(safe-area-inset-bottom,0))] ${
          showTopBar ? "" : "pt-[max(env(safe-area-inset-top),0px)]"
        }`}
      >
        {showTopBar ? <AppTopBar /> : null}
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
