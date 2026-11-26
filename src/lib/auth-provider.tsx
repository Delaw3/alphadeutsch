"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

import {
  apiFetch,
  clearSessionToken,
  saveSessionToken,
  setUnauthorizedHandler,
} from "@/lib/apiFetch";
import { normalizePathname } from "@/lib/routes";
import { clearToken, getToken, hydrate, setToken } from "@/lib/token-store";

export type Me = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  reg_no?: string | null;
  phone?: string | null;
};

export type AuthState = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  state: AuthState;
  user: Me | null;
  signIn: (token: string, user: Me) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Routes that anonymous users must be allowed to open. `/student-setup` is the
 * "already a student" flow that signup redirects to, so it has to be public —
 * otherwise the guard bounces the user straight back to /sign-in.
 *
 * Entries are written without a trailing slash; `usePathname()` is normalised
 * with `normalizePathname()` before any comparison (the mobile export runs with
 * `trailingSlash: true`, so raw pathnames look like `/sign-up/`).
 */
const PUBLIC_ROUTES = new Set(["/sign-in", "/sign-up", "/student-setup", "/verify-email", "/forgot-password"]);

/**
 * Token store facade. Persistence is platform-aware (localStorage on the web,
 * Android Keystore in the packaged app — see `token-store.ts`); `get()` is
 * synchronous because `token-store` keeps an in-memory copy.
 */
export const tokenStorage = {
  get(): string | null {
    return getToken();
  },
  set(token: string): void {
    // Fire-and-forget so callers can render immediately, but surface the reason
    // instead of swallowing it: token-store rejects when the token could not be
    // persisted (e.g. Keystore unavailable).
    void setToken(token).catch((err) => {
      console.error("[auth] session token was not persisted", err);
    });
  },
  clear(): void {
    void clearToken().catch((err) => {
      console.error("[auth] session token was not cleared from storage", err);
    });
  },
};

function Splash() {
  return (
    <div className="mobile-app-shell min-h-dvh bg-app-bg flex flex-col items-center justify-center gap-2">
      <img
        src="/brand/logo-256.png"
        alt="Alpha Deutsch"
        width={40}
        height={40}
        className="h-10 w-10 rounded-xl"
      />
      <p className="text-xs text-app-muted">Loading…</p>
    </div>
  );
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  // Normalise once: the mobile export (`trailingSlash: true`) reports routes as
  // "/sign-up/", which must still match the slash-less PUBLIC_ROUTES entries and
  // the "/sign-in" comparison below. No-op on the web build.
  const routePath = normalizePathname(pathname);
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    setUnauthorizedHandler((tokenUsed) => {
      // Ignore 401s from a request that used a token which has since been
      // replaced (e.g. a stale /api/me call racing with a fresh signup).
      if (tokenUsed && tokenStorage.get() !== tokenUsed) return;
      tokenStorage.clear();
      clearSessionToken();
      setState("anonymous");
      setUser(null);
      if (routePath !== "/sign-in") router.replace("/sign-in");
    });
  }, [routePath, router]);

  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setState((prev) => (prev === "loading" ? "anonymous" : prev));
      }
    }, 5000);

    (async () => {
      // Android Keystore reads are async: wait for the stored token before any
      // protected request, so a saved session is restored after a restart.
      await hydrate();
      const token = tokenStorage.get();
      if (!token) {
        if (mounted) setState("anonymous");
        return;
      }
      try {
        const data = await apiFetch<Me>("/api/me");
        if (mounted) {
          setState("authenticated");
          setUser(data);
        }
      } catch {
        // Only sign the user out if the token that failed is still the current
        // one. A signup/sign-in may have replaced it while this call was in
        // flight, and clearing it would bounce the new session to /sign-in.
        if (mounted && tokenStorage.get() === token) {
          tokenStorage.clear();
          clearSessionToken();
          setState("anonymous");
          setUser(null);
        }
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (state === "loading") return;
    if (state === "authenticated" && PUBLIC_ROUTES.has(routePath)) {
      router.replace("/home");
      return;
    }
    if (state === "anonymous" && !PUBLIC_ROUTES.has(routePath) && routePath !== "/") {
      router.replace("/sign-in");
    }
  }, [state, routePath, router]);

  const signIn = (token: string, user: Me) => {
    tokenStorage.set(token);
    saveSessionToken(token);
    setState("authenticated");
    setUser(user);
    // Navigation is owned by the guard effect above. Calling router.replace here
    // as well started two overlapping "/home" transitions, which can abort each
    // other and leave the sign-in screen mounted after a successful POST.
    // The fallback guarantees the outcome even if a client-side transition is
    // dropped: a hard navigation restores the session from persisted storage.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (PUBLIC_ROUTES.has(normalizePathname(window.location.pathname))) {
          window.location.replace("/home");
        }
      }, 5000);
    }
  };

  const signOut = async () => {
    try {
      await apiFetch("/api/auth/signout", { method: "POST" });
    } catch { /* ignore: clear locally regardless */ }
    tokenStorage.clear();
    clearSessionToken();
    setState("anonymous");
    setUser(null);
    router.replace("/sign-in");
  };

  if (state === "loading") {
    return <Splash />;
  }

  return (
    <AuthContext.Provider value={{ state, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
