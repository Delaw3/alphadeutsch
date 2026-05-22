"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { siteConfig } from "@/lib/constants";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/courses", label: "Our Courses" },
  { href: "/staff", label: "Staff" },
  { href: "/student-portal", label: "Portal" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("alpha-deutsch-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = storedTheme === "dark" || (!storedTheme && prefersDark) ? "dark" : "light";

    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem("alpha-deutsch-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  return (
    <header className="site-header sticky top-0 z-50 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
      <div className="flag-strip h-1" />
      <nav className="container-shell flex items-center justify-between gap-4 py-3 lg:py-1.5">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-full" onClick={() => setIsOpen(false)}>
          <span className="relative block h-14 w-56 overflow-visible sm:h-16 sm:w-64 lg:h-16 lg:w-64">
            <img
              src={siteConfig.logos.lightTheme}
              alt="Alpha Deutsch"
              className="site-logo-dark h-full w-full scale-[1.62] object-contain object-left origin-left lg:scale-150"
            />
            <img
              src={siteConfig.logos.darkTheme}
              alt="Alpha Deutsch"
              className="site-logo-white h-full w-full scale-[1.62] object-contain object-left origin-left lg:scale-150"
            />
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#0a1224]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle focus-ring grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-[#0a1224] transition hover:bg-slate-50"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span className="theme-toggle-mark" />
          </button>
          <ButtonLink href="/courses" variant="secondary">
            Start Learning
          </ButtonLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle focus-ring grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 sm:size-12"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span className="theme-toggle-mark" />
          </button>
          <button
            type="button"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsOpen((current) => !current)}
            className="menu-toggle focus-ring grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 sm:size-12"
          >
            <span className="relative block h-5 w-6">
              <span
                className={`absolute left-0 top-0 h-0.5 w-6 rounded-full bg-[#0a1224] transition duration-300 ${
                  isOpen ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-2 h-0.5 w-6 rounded-full bg-[#0a1224] transition duration-300 ${
                  isOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-4 h-0.5 w-6 rounded-full bg-[#0a1224] transition duration-300 ${
                  isOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </nav>

      <div
        id="mobile-navigation"
        className={`container-shell grid overflow-hidden transition-all duration-300 ease-out lg:hidden ${
          isOpen ? "max-h-[520px] pb-4 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="surface grid gap-2 rounded-3xl p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="focus-ring rounded-2xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 hover:text-[#0a1224]"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/courses"
            onClick={() => setIsOpen(false)}
            className="focus-ring mt-2 rounded-2xl bg-[#ffce45] px-4 py-3 text-center text-sm font-black text-[#101828] transition hover:bg-[#f3bd22]"
          >
            Start Learning
          </Link>
        </div>
      </div>
    </header>
  );
}
