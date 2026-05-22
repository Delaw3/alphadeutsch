import Link from "next/link";
import { siteConfig } from "@/lib/constants";

const footerLinks = [
  { href: "/courses", label: "Courses" },
  { href: "/study-in-germany", label: "Study in Germany" },
  { href: "/staff", label: "Staff" },
  { href: "/student-portal", label: "Result Portal Preview" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="mt-20 bg-[#0a1224] text-white">
      <div className="flag-strip h-1" />
      <div className="container-shell grid gap-10 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <img src={siteConfig.logos.darkTheme} alt="Alpha Deutsch" className="h-14 w-48 object-contain object-left" />
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">{siteConfig.description}</p>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffce45]">Explore</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#ffce45]">Contact</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <span>{siteConfig.email}</span>
            <span>{siteConfig.emailAlt}</span>
            <span>{siteConfig.phone}</span>
            <span>{siteConfig.phoneAlt}</span>
            <span>{siteConfig.address}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5">
        <p className="container-shell text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Alpha Deutsch. Powered by{" "}
          <a
            href="https://www.dexarptech.com"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#ffce45] transition hover:text-white"
          >
            Dexarptech
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
