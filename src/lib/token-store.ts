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
    // Never resolve with the plugin proxy itself. A Capacitor plugin proxy
    // answers every property access — including `then` — so returning it (or
    // awaiting it anywhere) makes JavaScript treat it as a thenable and throw
    // `"SecureStorage.then()" is not implemented on android`, which aborted
    // hydration before the token was ever read. A plain wrapper keeps the proxy
    // one level down, where it is only ever touched to call plugin methods.
    const plugin = SecureStorage as unknown as NativeStore;
    return {
      get: (key) => plugin.get(key),
      set: (key, value) => plugin.set(key, value),
      remove: (key) => plugin.remove(key),
    };
  } catch (err) {
    // Cannot use the Keystore: report it, and leave the store unavailable so
    // writes fail loudly instead of pretending to have persisted anything.
    console.error("[token-store] secure storage unavailable", err);
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
      console.error("[token-store] secure storage unavailable: staying signed out");
      return;
    }
    try {
      const stored = await nativeStore.get(TOKEN_KEY);
      // A token written by setToken() before hydration finished is newer than
      // anything in storage: never clobber it.
      if (cached === null) {
        cached = typeof stored === "string" && stored.length > 0 ? stored : null;
      }
    } catch (err) {
      // Keystore unavailable / corrupted entry: keep the user logged out rather
      // than crashing (a fresh token set in the meantime survives). A new
      // sign-in will write a new token.
      console.error("[token-store] secure storage read failed", err);
    }
    return;
  }

  mode = "web";
  // Same rule as the native branch: never overwrite a token that was set while
  // hydration was in flight.
  if (cached === null) cached = webRead();
}

/** Resolves once the active storage backend has been detected and read. Idempotent. */
export function hydrate(): Promise<void> {
  if (!hydration) {
    hydration = runHydration().catch((err) => {
      // Hydration must never take the app down, but it must not hide the cause.
      cached = null;
      console.error("[token-store] hydration failed", err);
    });
  }
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

/**
 * Persists a token. Updates the cache first so the next request already uses it.
 *
 * Rejects when the token could not be written to the platform store, so callers
 * never report a token as persisted when it is only in memory. The running
 * session stays usable either way — a write failure must not break it, it only
 * means the session cannot be restored after a restart.
 */
export async function setToken(token: string): Promise<void> {
  // Visible to getToken() in the same tick, and durable before the first await:
  // the sign-in screen navigates immediately, and the next route gates its first
  // requests on hasSessionToken(). A slow transition, a remount or a reload
  // during it must never observe a null/older token.
  cached = token;
  if (mode === "web") webWrite(token);

  await hydrate();

  if (mode === "native") {
    if (!nativeStore) {
      throw new Error("[token-store] secure storage unavailable: token kept in memory only");
    }
    // Let the plugin's StorageError propagate instead of faking success.
    await nativeStore.set(TOKEN_KEY, token);
    return;
  }

  if (mode === "web") webWrite(token);
}

/**
 * Removes the token from cache and from the platform store.
 *
 * Rejects when the stored copy could not be removed: otherwise the Keystore
 * entry would survive the logout and be restored on the next launch.
 */
export async function clearToken(): Promise<void> {
  cached = null;
  await hydrate();

  if (mode === "native") {
    if (!nativeStore) return; // nothing was ever persisted natively
    await nativeStore.remove(TOKEN_KEY);
    return;
  }

  if (mode === "web") webRemove();
}
