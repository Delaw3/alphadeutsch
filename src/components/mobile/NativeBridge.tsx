"use client";

import { useEffect } from "react";

import { hasExplicitThemeChoice, prefersDarkTheme, syncStatusBarTheme } from "@/lib/status-bar-theme";

/**
 * Native-only shell behaviour (status bar, splash screen, Android back button).
 *
 * Every plugin is imported dynamically *after* confirming the app is running
 * natively, so the browser bundle never loads Capacitor plugin code and the
 * website behaves exactly as before.
 */
export function NativeBridge() {
  useEffect(() => {
    let removed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        // Fallback for the pre-paint script in app/layout.tsx (in case Capacitor
        // was not injected yet when it ran). Drives the Android header spacing.
        document.documentElement.classList.add("is-native");
        if (Capacitor.getPlatform() === "android") {
          document.documentElement.classList.add("is-native-android");
        }

        const [{ SplashScreen }, { App }] = await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/app"),
        ]);
        if (removed) return;

        // Status bar follows the current theme: dark icons on the light UI,
        // light icons on the dark UI. Failures are non-fatal.
        void syncStatusBarTheme(prefersDarkTheme());

        // Follow the OS appearance while the user has not chosen a theme.
        const scheme = window.matchMedia("(prefers-color-scheme: dark)");
        const onSchemeChange = () => {
          if (hasExplicitThemeChoice()) return;
          void syncStatusBarTheme(scheme.matches);
        };
        scheme.addEventListener("change", onSchemeChange);
        cleanups.push(() => scheme.removeEventListener("change", onSchemeChange));

        SplashScreen.hide().catch(() => {});

        // Hardware back: behave like the browser (leave the page) and only exit
        // the app when there is no in-app history left.
        const backListener = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
            return;
          }
          App.exitApp().catch(() => {});
        });
        cleanups.push(() => void backListener.remove());
      } catch {
        // A missing plugin must never block the app shell.
      }
    })();

    return () => {
      removed = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
