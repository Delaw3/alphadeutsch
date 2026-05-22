import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-shell py-24 text-center">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#dd1f2d]">404</p>
      <h1 className="mt-4 text-4xl font-black text-[#0a1224]">Page not found</h1>
      <p className="mx-auto mt-4 max-w-xl text-slate-600">The page you are looking for is not part of this prototype.</p>
      <Link
        href="/"
        className="focus-ring mt-8 inline-flex min-h-11 items-center rounded-full bg-[#ffce45] px-5 py-3 text-sm font-black text-[#101828]"
      >
        Back home
      </Link>
    </section>
  );
}
