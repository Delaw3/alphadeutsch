import type { NextConfig } from "next";

/**
 * Mobile (Capacitor/Android) static-export switch.
 *
 * Unset  -> the normal Vercel/web build (output unchanged, API routes intact).
 * "mobile" -> `next build` produces a static `out/` directory:
 *   - output: "export"        no server runtime in the bundle
 *   - trailingSlash: true     /home/ => home/index.html (needed by the WebView)
 *   - pageExtensions          drops ".ts" from route discovery so the 15
 *                             api route handlers under src/app/api are NOT
 *                             built and therefore cannot leak mysql2/server-only
 *                             code into the static bundle. Every page/layout is .tsx.
 *
 * NEXT_PUBLIC_API_BASE_URL is mandatory for mobile builds: the packaged app has
 * no same-origin API, so silently defaulting to localhost would ship a broken app.
 */
const isMobileExport = process.env.BUILD_TARGET === "mobile";

if (isMobileExport && !process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) {
  throw new Error(
    "BUILD_TARGET=mobile requires NEXT_PUBLIC_API_BASE_URL (e.g. https://your-api-host). " +
      "Refusing to build a mobile bundle without an explicit API host.",
  );
}

const mobileConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  pageExtensions: ["tsx", "jsx", "js"],
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isMobileExport ? mobileConfig : {}),
};

export default nextConfig;
