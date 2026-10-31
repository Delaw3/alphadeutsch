"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Shared loading indicators.
 *
 * - `MiniSpinner`: small inline spinner for buttons and inline actions.
 * - `NavigationLoader`: slim top progress bar shown while a route change is in
 *   flight. Instant navigations never show it (150ms grace period), it is
 *   always cleared when the route changes (success) and after a safety
 *   timeout if a navigation is cancelled or fails.
 */

const SHOW_AFTER_MS = 150;
const MAX_VISIBLE_MS = 10_000;

export function MiniSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimer.current !== null) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
    };
    const clearHideTimer = () => {
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };

    // Only show the bar if the navigation is not essentially instant.
    const scheduleShow = () => {
      if (showTimer.current !== null || hideTimer.current !== null) return;
      showTimer.current = setTimeout(() => {
        showTimer.current = null;
        setVisible(true);
        // Safety net: never leave the indicator stuck if the navigation
        // fails, is cancelled, or no route change ever lands.
        hideTimer.current = setTimeout(() => {
          hideTimer.current = null;
          setVisible(false);
        }, MAX_VISIBLE_MS);
      }, SHOW_AFTER_MS);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      // Same route (query/hash-only changes) resolves instantly: skip it.
      if (href.split(/[?#]/)[0] === pathname) return;
      scheduleShow();
    };

    const handlePopState = () => scheduleShow();

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearShowTimer();
      clearHideTimer();
    };
  }, [pathname]);

  // Route changed (navigation succeeded) - always reset the indicator.
  useEffect(() => {
    if (showTimer.current !== null) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60]">
      <div
        role="progressbar"
        aria-label="Loading page"
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-full overflow-hidden bg-app-border"
      >
        <div className="nav-progress-bar h-full w-2/5 bg-app-inverse" />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        Loading page…
      </span>
    </div>
  );
}
