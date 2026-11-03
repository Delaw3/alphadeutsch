"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

import {
  apiFetch,
  clearSessionToken,
  saveSessionToken,
  setUnauthorizedHandler,
} from "@/lib/apiFetch";

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

/** localStorage-backed token store; swap later for Capacitor secure storage. */
export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("sessionToken");
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem("sessionToken", token);
    } catch { /* ignore */ }
  },
  clear(): void {
    try {
      localStorage.removeItem("sessionToken");
    } catch { /* ignore */ }
  },
};

function Splash() {
  return (
    <div className="mobile-app-shell min-h-dvh bg-app-bg flex flex-col items-center justify-center gap-2">
      <img
        src="/icon.svg"
        alt="Alpha Deutsch"
        className="h-10 w-auto"
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
  const [state, setState] = useState<AuthState>("loading");
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStorage.clear();
      clearSessionToken();
      setState("anonymous");
      setUser(null);
      if (pathname !== "/sign-in") router.replace("/sign-in");
    });
  }, [pathname, router]);

  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setState((prev) => (prev === "loading" ? "anonymous" : prev));
      }
    }, 5000);

    (async () => {
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
        if (mounted) {
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
    const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
    if (state === "authenticated" && isAuthRoute) {
      router.replace("/home");
      return;
    }
    if (state === "anonymous" && !isAuthRoute && pathname !== "/") {
      router.replace("/sign-in");
    }
  }, [state, pathname, router]);

  const signIn = (token: string, user: Me) => {
    tokenStorage.set(token);
    saveSessionToken(token);
    setState("authenticated");
    setUser(user);
    router.replace("/home");
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
