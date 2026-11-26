/**
 * Android status-bar appearance, kept in sync with the app theme.
 *
 * `@capacitor/status-bar` names its enum the opposite way round from what most
 * people expect (see `dist/esm/definitions.d.ts` in the installed 8.0.4):
 *
 *   Style.Light -> **dark** text/icons, for light backgrounds
 *   Style.Dark  -> **light** text/icons, for dark backgrounds
 *
 * Using `Style.Dark` on a light UI is what made the clock and battery icons
 * white on a near-white status bar.
 *
 * Everything here is native-only and dynamically imported, so the website keeps
 * its exact behaviour and never loads plugin code.
 */

/** Matches `--app-bg` from globals.css, so the bar blends with the app. */
export const APP_THEME_BG = {
  light: "#f6f7f9",
  dark: "#0a0e17",
} as const;

/** Same precedence as the pre-paint theme script in `app/layout.tsx`. */
export function prefersDarkTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem("alphadeutsch-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** True only when the user has picked light/dark explicitly (not OS-driven). */
export function hasExplicitThemeChoice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem("alphadeutsch-theme");
    return stored === "dark" || stored === "light";
  } catch {
    return false;
  }
}

/**
 * Applies the status-bar icon colour and (pre-Android-15) background for the
 * current theme. Safe to call repeatedly; never throws.
 */
export async function syncStatusBarTheme(isDark: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const { StatusBar, Style } = await import("@capacitor/status-bar");

    // Light UI -> dark icons; dark UI -> light icons.
    const style = isDark ? Style.Dark : Style.Light;
    await StatusBar.setStyle({ style }).catch(() => {});

    // Ignored on Android 15+ (edge-to-edge draws the app behind the bar), but
    // keeps the bar matching the app on older devices.
    await StatusBar.setBackgroundColor({
      color: isDark ? APP_THEME_BG.dark : APP_THEME_BG.light,
    }).catch(() => {});
  } catch {
    /* Plugin unavailable: the app must never fail because of the status bar. */
  }
}
