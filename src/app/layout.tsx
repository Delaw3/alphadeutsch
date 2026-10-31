import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NavigationLoader } from "@/components/mobile/MobileLoaders";
import { AuthProvider } from "@/lib/auth-provider";
import { siteConfig } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: "Alpha Deutsch",
  title: {
    default: "Alpha Deutsch App",
    template: "%s | Alpha Deutsch",
  },
  description: siteConfig.description,
};

/**
 * Runs before hydration to apply the persisted theme with no flash and no
 * hydration mismatch (`suppressHydrationWarning` is set on <html>/<body>).
 * Falls back to the OS preference when the user has not chosen yet.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("alphadeutsch-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <div className="mobile-app-shell min-h-dvh bg-app-bg text-app-text">
          <NavigationLoader />
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}

