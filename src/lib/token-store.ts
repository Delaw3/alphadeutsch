/**
 * Platform-aware session-token storage.
 *
 * Browser  -> `localStorage` (exactly the previous behaviour, so existing web
 *             sessions keep working and are never invalidated).
 * Android  -> `@aparajita/capacitor-secure-storage`, which encrypts values with
 *             the Android Keystore (EncryptedSharedPreferences). Tokens are
 *             NEVER written to localStorage inside the native app.
 *
 * Reads are synchronous (`getToken()`) so the existing `apiFetch` contract and
 * every `hasSessionToken()` call site stay unchanged. The value is served from
 * an in-memory cache that `hydrate()` fills once at startup — native storage is
 * async, so protected requests must wait for `hydrate()` (the AuthProvider keeps
 * the app on its splash screen until it resolves).
 *
 * Tokens are never logged.
 */

const TOKEN_KEY = "sessionToken";

type Mode = "web" | "native";

type NativeStore = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<boolean>;
};

let mode: Mode | null = null;
let cached: string | null = null;
let nativeStore: NativeStore | null = null;
let hydration: Promise<void> | null = null;

function webRead(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function webWrite(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch { /* ignore: quota/private mode */ }
}

function webRemove(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function detectPlatform(): Promise<Mode> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() ? "native" : "web";
  } catch {
    return "web";
  }
}

async function loadNativeStore(): Promise<NativeStore | null> {
  try {
    const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
    return SecureStorage as unknown as NativeStore;
  } catch {
    return null;
  }
}

async function runHydration(): Promise<void> {
  if (typeof window === "undefined") {
    mode = "web";
    cached = null;
    return;
  }

  if ((await detectPlatform()) === "native") {
    // Inside the APK there is deliberately no localStorage fallback: if the
    // Keystore plugin is unavailable the user simply stays signed out (once)
    // rather than having a token written in clear text.
    mode = "native";
    nativeStore = await loadNativeStore();
    if (!nativeStore) {
      cached = null;
      console.warn("[token-store] secure storage unavailable");
      return;
    }
    try {
      const stored = await nativeStore.get(TOKEN_KEY);
      cached = typeof stored === "string" && stored.length > 0 ? stored : null;
    } catch {
      // Keystore unavailable / corrupted entry: keep the user logged out rather
      // than crashing. A fresh sign-in will write a new token.
      cached = null;
      console.warn("[token-store] secure storage read failed");
    }
    return;
  }

  mode = "web";
  cached = webRead();
}

/** Resolves once the active storage backend has been detected and read. Idempotent. */
export function hydrate(): Promise<void> {
  if (!hydration) hydration = runHydration().catch(() => { cached = null; });
  return hydration;
}

/** The current token (memory cache). Safe to call from render/effect code. */
export function getToken(): string | null {
  return cached;
}

/** True once the platform storage has been read (native storage is async). */
export function isHydrated(): boolean {
  return mode !== null;
}

/** True when running inside the packaged app (Keystore-backed storage). */
export function isNativeStorage(): boolean {
  return mode === "native";
}

/** Persists a token. Updates the cache first so the next request already uses it. */
export async function setToken(token: string): Promise<void> {
  await hydrate();
  cached = token;

  try {
    if (mode === "native" && nativeStore) {
      await nativeStore.set(TOKEN_KEY, token);
    } else if (mode === "web") {
      webWrite(token);
    }
  } catch {
    // Storage failure must not break the running session: the token stays in
    // memory, the user simply has to sign in again after a restart.
    console.warn("[token-store] secure storage write failed");
  }
}

/** Removes the token from cache and from the platform store. */
export async function clearToken(): Promise<void> {
  cached = null;
  await hydrate();

  try {
    if (mode === "native" && nativeStore) {
      await nativeStore.remove(TOKEN_KEY);
    } else if (mode === "web") {
      webRemove();
    }
  } catch {
    console.warn("[token-store] secure storage clear failed");
  }
}
