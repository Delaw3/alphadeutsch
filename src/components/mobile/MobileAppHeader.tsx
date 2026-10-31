"use client";


import { siteConfig } from "@/lib/constants";

export function MobileAppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-app-border bg-app-surface/95 pt-[max(env(safe-area-inset-top),0px)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <img
          src="/logos/darkl.png"
          alt="Alpha Deutsch"
          className="h-8 w-auto shrink-0 dark:hidden"
        />
        <img
          src="/logos/whitel.png"
          alt="Alpha Deutsch"
          className="hidden h-8 w-auto shrink-0 dark:block"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black leading-tight text-app-text">
            {siteConfig.name}
          </p>
        </div>

      </div>
    </header>
  );
}
