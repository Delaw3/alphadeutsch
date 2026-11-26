/**
 * Mobile-safe API fetch helper.
 *
 * Prefixes NEXT_PUBLIC_API_BASE_URL, injects a Bearer session token from the
 * platform token store (localStorage on the web, Android Keystore in the native
 * app), and throws on non-2xx responses with the server error message.
 * All mobile UI pages must use this helper – never call /api/* directly.
 */
import { clearToken, getToken, setToken } from '@/lib/token-store';

export interface ApiFetchOptions extends RequestInit {
  /** Query parameters appended to the URL. */
  query?: Record<string, string | number | boolean>;
}

/**
 * Error thrown for any non-2xx response. `code` is the server's stable auth
 * error code (`invalid-credentials`, `code-invalid`, `email-not-verified`, …)
 * and lets screens react differently to failures that share a status code.
 */
export type ApiFetchError = Error & { status: number; code?: string };

/** Reads the server error code from an `apiFetch` rejection, if it has one. */
export function apiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function readToken(): string | null {
  return getToken();
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
  // Use URL constructor only when base is absolute; otherwise build manually.
  const href = base ? `${base}${path}` : path;
  const url = new URL(href, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.append(k, String(v));
    }
  }

  // `query` is applied to `url` above; discard it so it is never forwarded to fetch().
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { query: _q, headers: callerHeaders, body, method, ...rest } = options;
  const headers = new Headers(callerHeaders);

  const token = readToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const isWrite = method && method !== 'GET' && method !== 'HEAD';
  if (isWrite && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const resolvedBody =
    isWrite && body != null && typeof body !== 'string'
      ? JSON.stringify(body)
      : (body as BodyInit | undefined);

  const controller = options.signal ? null : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 10000)
    : null;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...rest,
      method,
      headers,
      body: resolvedBody,
      cache: 'no-store',
      signal: options.signal ?? controller?.signal,
    });
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.', { cause: err });
    }
    throw err;
  }
  if (timeoutId) clearTimeout(timeoutId);

  if (response.status === 204) return null as T;

  if (!response.ok) {
    let message = 'An error occurred. Please try again.';
    let code: string | undefined;
    try {
      const data = await response.json();
      if (typeof data?.message === 'string') message = data.message;
      else if (typeof data?.error === 'string') message = data.error;
      if (typeof data?.code === 'string' && data.code.length > 0) code = data.code;
    } catch { /* ignore */ }
    if (response.status === 401) {
      onUnauthorized?.(token);
    }
    const err = new Error(message) as ApiFetchError;
    err.status = response.status;
    if (code) err.code = code;
    throw err;
  }

  return response.json() as Promise<T>;
}

/** Store the session token returned by sign-in. */
export function saveSessionToken(token: string): void {
  // Fire-and-forget (the UI proceeds immediately), but never swallow the reason:
  // token-store rejects when the token could not be persisted.
  void setToken(token).catch((err) => {
    console.error('[apiFetch] session token was not persisted', err);
  });
}

/** Remove the session token on sign-out. */
export function clearSessionToken(): void {
  void clearToken().catch((err) => {
    console.error('[apiFetch] session token was not cleared from storage', err);
  });
}

/** Whether any token is currently stored. */
export function hasSessionToken(): boolean {
  return readToken() !== null;
}

let onUnauthorized: ((tokenUsed: string | null) => void) | null = null;

/**
 * Register a global handler invoked on any 401 response (e.g. clear token + redirect).
 * Receives the token that the failed request used so callers can ignore stale
 * 401s from a session that has already been replaced.
 */
export function setUnauthorizedHandler(handler: (tokenUsed: string | null) => void): void {
  onUnauthorized = handler;
}
