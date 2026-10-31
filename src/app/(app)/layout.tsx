"use client";

import type { ReactNode } from "react";

import { MobileAppHeader } from "@/components/mobile/MobileAppHeader";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

export default function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="mobile-app-shell min-h-dvh bg-app-bg text-app-text">
      <MobileAppHeader />
      <main className="mobile-app-main pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
