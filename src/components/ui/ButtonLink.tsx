import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function ButtonLink({ href, children, variant = "primary" }: ButtonLinkProps) {
  const variants = {
    primary: "bg-[#dd1f2d] text-white shadow-lg shadow-red-900/15 hover:bg-[#c81724]",
    secondary:
      "bg-[linear-gradient(135deg,#ffce45_0%,#ffb21f_42%,#dd1f2d_100%)] text-black shadow-lg shadow-yellow-900/20 hover:shadow-xl hover:shadow-red-900/20",
    ghost: "border border-white/40 bg-white/0 text-white hover:border-white/70 hover:bg-white/10",
  };

  return (
    <Link
      href={href}
      className={`focus-ring inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${variants[variant]}`}
    >
      {children}
    </Link>
  );
}
