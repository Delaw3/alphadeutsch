import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-10 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-app-muted">404</p>
      <h1 className="mt-2 text-2xl font-black text-app-text">Screen not found</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-app-muted">
        The screen you are looking for could not be found.
      </p>
      <Link
        href="/"
        className="focus-ring mt-6 inline-flex min-h-[52px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent"
      >
        Back home
      </Link>
    </div>
  );
}

