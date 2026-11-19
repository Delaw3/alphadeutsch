"use client";

import { useEffect } from "react";

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

        const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
          import("@capacitor/app"),
        ]);
        if (removed) return;

        // Match the app's light theme; failures are non-fatal.
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: "#FFC93C" }).catch(() => {});

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
