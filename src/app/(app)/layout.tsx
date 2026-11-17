"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { AppTopBar } from "@/components/mobile/AppTopBar";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname() ?? "/";
  // Show the shared top bar on the Courses and My Learning screens only.
  const showTopBar =
    pathname === "/courses" ||
    pathname.startsWith("/courses/") ||
    pathname === "/learning" ||
    pathname.startsWith("/learning/");

  return (
    <div className="mobile-app-shell min-h-dvh bg-app-bg text-app-text">
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
