import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NavigationLoader } from "@/components/mobile/MobileLoaders";
import { NativeBridge } from "@/components/mobile/NativeBridge";
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
  manifest: "/manifest.webmanifest",
  /** Brand icon (white "A" on the German flag) generated from alphadeutsch.com/favicon.ico. */
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icons/icon-192x192.png?v=2", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png?v=2", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["/favicon.ico?v=2"],
    apple: [{ url: "/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

/**
 * Viewport: zoom is disabled (app-style UI) and viewport-fit=cover lets the
 * safe-area padding in globals.css work on notched phones.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFC93C",
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
      <head>
        {/* iOS Add to Home Screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Alpha Deutsch" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!('serviceWorker' in navigator))return;var enableSw=${JSON.stringify(
              process.env.NODE_ENV === "production" &&
                process.env.NEXT_PUBLIC_BUILD_TARGET !== "android",
            )};if(enableSw){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}else{navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});}).catch(function(){});if(window.caches&&caches.keys){caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k);});}).catch(function(){});}}})();`,
          }}
        />
        <div className="mobile-app-shell min-h-dvh bg-app-bg text-app-text">
          <NavigationLoader />
          <AuthProvider>{children}</AuthProvider>
          <NativeBridge />
        </div>
      </body>
    </html>
  );
}