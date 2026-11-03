"use client";


export function MobileAppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-app-surface/80 backdrop-blur-xl pt-[max(env(safe-area-inset-top),0px)]">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <img
          src="https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/logos/darkl.png"
          alt="Alpha Deutsch"
          className="h-8 w-auto shrink-0 dark:hidden"
        />
        <img
          src="https://pvjwquzgfkspweijebwb.supabase.co/storage/v1/object/public/Alpha%20Deutsch/logos/whitel.png"
          alt="Alpha Deutsch"
          className="h-8 w-auto shrink-0 hidden dark:block"
        />
      </div>
    </header>
  );
}
