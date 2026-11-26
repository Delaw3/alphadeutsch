/**
 * Route path helpers.
 *
 * The mobile (Capacitor) export in `next.config.ts` sets `trailingSlash: true`,
 * so inside the packaged app `usePathname()` returns paths such as `/sign-up/`.
 * Route allow-lists and exact route comparisons are written without the slash,
 * so any exact comparison has to run through `normalizePathname` first.
 *
 * The web build has no trailing slash, so this is a no-op there.
 */

/**
 * Returns `pathname` without trailing slashes. `"/"` is preserved as `"/"`.
 *
 * Only trailing slashes are stripped — case, query and hash are untouched
 * (`usePathname()` never includes the latter two anyway).
 */
export function normalizePathname(pathname: string): string {
  if (pathname.length <= 1) {
    // "" (defensive) and "/" both normalise to "/".
    return "/";
  }
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}
