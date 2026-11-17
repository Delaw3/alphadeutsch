"use client";

import { AppMenu } from "./AppMenu";

export function MobileAppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-app-surface/80 backdrop-blur-xl pt-[max(env(safe-area-inset-top),0px)]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <AppMenu />
      </div>
    </header>
  );
}
