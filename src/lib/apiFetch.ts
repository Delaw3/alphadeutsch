/**
 * Mobile-safe API fetch helper.
 *
 * Prefixes NEXT_PUBLIC_API_BASE_URL, injects a Bearer session token from
 * localStorage, and throws on non-2xx responses with the server error message.
 * All mobile UI pages must use this helper – never call /api/* directly.
 */
export interface ApiFetchOptions extends RequestInit {
  /** Query parameters appended to the URL. */
  query?: Record<string, string | number | boolean>;
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('sessionToken');
  } catch {
    return null;
  }
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
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
  if (timeoutId) clearTimeout(timeoutId);

  if (response.status === 204) return null as T;

  if (!response.ok) {
    let message = 'An error occurred. Please try again.';
    try {
      const data = await response.json();
      if (typeof data?.message === 'string') message = data.message;
      else if (typeof data?.error === 'string') message = data.error;
    } catch { /* ignore */ }
    if (response.status === 401) {
      onUnauthorized?.();
    }
    const err = new Error(message) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  return response.json() as Promise<T>;
}

/** Store the session token returned by sign-in. */
export function saveSessionToken(token: string): void {
  try {
    localStorage.setItem('sessionToken', token);
  } catch { /* ignore */ }
}

/** Remove the session token on sign-out. */
export function clearSessionToken(): void {
  try {
    localStorage.removeItem('sessionToken');
  } catch { /* ignore */ }
}

/** Whether any token is currently stored. */
export function hasSessionToken(): boolean {
  return readToken() !== null;
}

let onUnauthorized: (() => void) | null = null;

/** Register a global handler invoked on any 401 response (e.g. clear token + redirect). */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}
