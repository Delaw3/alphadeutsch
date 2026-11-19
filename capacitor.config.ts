import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Alpha Deutsch Android app.
 *
 * The app is a *packaged* frontend: `webDir` points at the Next.js static export
 * (`out/`, produced by `npm run build:mobile`). There is deliberately no
 * `server.url` — loading the website from a remote WebView is not allowed; only
 * API calls go to the hosted backend (NEXT_PUBLIC_API_BASE_URL, baked in at
 * build time as https://alphadeutsch.vercel.app).
 *
 * `androidScheme: "https"` makes the WebView origin `https://localhost`, which is
 * one of the three origins allowed by the API's CORS policy.
 */
const config: CapacitorConfig = {
  appId: "com.alphadeutsch.app",
  appName: "Alpha Deutsch",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B1220",
  },
  plugins: {
    SplashScreen: {
      // Hidden by the app once the auth bootstrap finishes (see NativeBridge).
      launchAutoHide: false,
      backgroundColor: "#FFC93C",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FFC93C",
      overlaysWebView: false,
    },
  },
};

export default config;
