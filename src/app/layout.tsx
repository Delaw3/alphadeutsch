import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { siteConfig } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Alpha Deutsch | Your Future in Germany Could Start Here",
    template: "%s | Alpha Deutsch",
  },
  description: siteConfig.description,
  keywords: ["Alpha Deutsch", "German language school in Nigeria", "Study in Germany", "German courses", "A1 German", "B1 German", "Awka"],
  openGraph: {
    title: "Alpha Deutsch",
    description: siteConfig.description,
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
