import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Lightweight, dependency-free performance instrumentation.
 *
 * - One structured JSON line per API request: route, method, status, total ms,
 *   aggregated db ms / query count. Slow requests (>= 1s) are logged at `warn`.
 * - One structured JSON line per slow or failed database query (>= 200ms).
 *   Fast queries are only aggregated into the request line, never logged one by one.
 * - Emitted via console.* so Vercel's built-in log capture picks them up: no SDK,
 *   no agent, no network calls.
 * - Nothing sensitive is logged: no bodies, cookies, Authorization headers,
 *   parameter values, tokens or student identifiers.
 *
 * Requires the Node.js runtime (`node:async_hooks`). Every route handler here uses
 * the default Node runtime; never set `export const runtime = "edge"` on a route
 * that (transitively) imports this module.
 */

const DEFAULT_SLOW_DB_MS = 200;
const DEFAULT_SLOW_API_MS = 1000;

function readThreshold(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Slow-query threshold in milliseconds (override: PERF_SLOW_DB_MS). */
export const SLOW_DB_MS = readThreshold(process.env.PERF_SLOW_DB_MS, DEFAULT_SLOW_DB_MS);

/** Slow-request threshold in milliseconds (override: PERF_SLOW_API_MS). */
export const SLOW_API_MS = readThreshold(process.env.PERF_SLOW_API_MS, DEFAULT_SLOW_API_MS);

type LogLevel = "info" | "warn" | "error";

/**
 * Ordered redaction rules, applied to every free-text value that reaches a log
 * line (error messages only — bodies and parameters are never logged at all).
 */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/\b\d{4}\s*\/\s*[A-Za-z]{2,4}\s*\/\s*\d+\b/g, "[reg_no]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[jwt]"],
  [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]{8,}=*/gi, "[auth_header]"],
  // Driver/auth messages can carry the connection identity, e.g.
  // "Access denied for user 'app'@'db-host'" — that is credential material.
  [/\buser\s+'[^']*'@'[^']*'/gi, "user '[db_user]'@'[db_host]'"],
  // DSN-style credentials: "password=..." / "passwd: ..." / "pwd=...".
  [/\b(?:password|passwd|pwd)\s*[=:]\s*\S+/gi, "[password]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "[secret]"],
  [/\b\+?\d{10,15}\b/g, "[number]"],
  // Local/international formats with spaces or dashes: "0712 345 678",
  // "+255 712 345 678". The lookbehind keeps the leading 0/+ from being found in
  // the middle of another number, so dates (2026-11-21) are not mangled.
  [/(?<!\d)(?:\+\d{1,3}[\s-]?|0)\d(?:[\s-]?\d){7,11}\b/g, "[number]"],
];

/** Strips tokens, e-mails, registration numbers and phone-number-like digits. */
export function redact(input: string): string {
  let output = input;
  for (const [pattern, replacement] of REDACTIONS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

/** Redacts and truncates a free-text value so one log line stays parseable. */
export function sanitizeText(input: string, maxLength = 180): string {
  const collapsed = redact(input).replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength)}...` : collapsed;
}

export type SafeErrorDetails = {
  name: string;
  code?: string;
  errno?: number;
  sqlState?: string;
  message?: string;
};

/**
 * A message shaped like a SQL statement is never logged verbatim: a driver error
 * without `code` could otherwise carry interpolated row values (names, etc.).
 * We still log the error `name`, `code`/`errno`/`sqlState` when present.
 */
const SQL_SHAPED_MESSAGE =
  /\b(?:insert\s+into|replace\s+into|select\s[\s\S]{0,200}?\sfrom|update\s+\S+\s+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i;

/**
 * Reduces an arbitrary thrown value to a log-safe shape.
 *
 * mysql2 errors may carry the interpolated SQL (and therefore row values) inside
 * `message` / `sql`; when a driver code exists the message is dropped entirely.
 * `stack` and `sql` are never logged.
 *
 * Arbitrary `message` text is the only free-form field that can reach a log line.
 * It is regex-redacted (e-mail, registration number, JWT, auth header, database
 * user/host, DSN password, long secret, phone-like digits) and truncated. A
 * message that looks like SQL is replaced wholesale with "[sql omitted]", because
 * an exotic driver error without `code` could otherwise carry interpolated row
 * values. Names and addresses are still NOT pattern-detectable, so a custom error
 * that interpolates a student name would leak it; if third-party errors start
 * being caught here, replace `message` with an allowlist keyed by `code`/`name`.
 */
export function describeError(error: unknown): SafeErrorDetails {
  if (!(error instanceof Error)) {
    const text = typeof error === "string" ? error : "unprintable error";
    return {
      name: "NonError",
      message: SQL_SHAPED_MESSAGE.test(text) ? "[sql omitted]" : sanitizeText(text),
    };
  }

  const candidate = error as Error & { code?: unknown; errno?: unknown; sqlState?: unknown };
  const details: SafeErrorDetails = { name: error.name || "Error" };
  const rawMessage = typeof error.message === "string" ? error.message : "";

  if (typeof candidate.code === "string" && candidate.code.trim()) {
    details.code = sanitizeText(candidate.code, 40);
  }
  if (typeof candidate.errno === "number") {
    details.errno = candidate.errno;
  }
  if (typeof candidate.sqlState === "string" && candidate.sqlState.trim()) {
    details.sqlState = sanitizeText(candidate.sqlState, 8);
  }
  if (!details.code && rawMessage) {
    details.message = SQL_SHAPED_MESSAGE.test(rawMessage) ? "[sql omitted]" : sanitizeText(rawMessage);
  }

  return details;
}

function emit(level: LogLevel, payload: Record<string, unknown>): void {
  let line: string;
  try {
    line = JSON.stringify({ level, ts: new Date().toISOString(), ...payload });
  } catch {
    return; // Never let logging break a request.
  }
  try {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    // A transport that throws (custom console, log shim, test spy) must never
    // change the outcome of the request or query being measured.
  }
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}


type RequestContext = {
  route: string;
  method: string;
  startedAt: number;
  dbMs: number;
  dbQueries: number;
  slowestDbMs: number;
  failedQueries: number;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

/** Route label of the in-flight request, or "background" outside a request. */
export function currentRoute(): string {
  return requestContext.getStore()?.route ?? "background";
}

export type DbQuerySample = {
  /** Verb + table only, e.g. "select:course_reg" — never parameter values. */
  label: string;
  ms: number;
  failed?: boolean;
};

/**
 * Records one database round-trip. Called by the pool wrapper in src/lib/db.ts.
 * Aggregates into the active request; logs only slow or failed queries.
 *
 * This function is deliberately wrapped: it runs inside the promise chain of the
 * query (and inside route `catch` blocks), so an exception here would turn a
 * successful query into a rejection. Instrumentation is best-effort by contract.
 */
export function recordDbQuery(sample: DbQuerySample): void {
  try {
    recordDbQueryUnsafe(sample);
  } catch {
    // Never let instrumentation change a query result or mask a query error.
  }
}

function recordDbQueryUnsafe(sample: DbQuerySample): void {
  const context = requestContext.getStore();
  if (context) {
    context.dbMs += sample.ms;
    context.dbQueries += 1;
    if (sample.ms > context.slowestDbMs) context.slowestDbMs = sample.ms;
    if (sample.failed) context.failedQueries += 1;
  }

  if (sample.failed) {
    emit("error", {
      event: "db.error",
      route: context?.route ?? "background",
      query: sample.label,
      ms: roundMs(sample.ms),
    });
    return;
  }

  if (sample.ms >= SLOW_DB_MS) {
    emit("warn", {
      event: "db.slow",
      route: context?.route ?? "background",
      query: sample.label,
      ms: roundMs(sample.ms),
      thresholdMs: SLOW_DB_MS,
    });
  }
}

/** Logs an expected authentication rejection (401/403/422/429). */
export function logAuthRejection(details: { code?: string; status?: number }): void {
  // Called from route error handlers: must never throw and replace the response.
  try {
    const status = typeof details.status === "number" ? details.status : 500;
    const level: LogLevel = status >= 500 ? "error" : status === 429 ? "warn" : "info";
    emit(level, {
      event: "auth.rejected",
      route: currentRoute(),
      status,
      code: details.code ? sanitizeText(details.code, 40) : undefined,
    });
  } catch {
    // See emit(): logging is not allowed to change an API outcome.
  }
}

/** Logs an unexpected (non-AuthError) failure as a sanitised error record. */
export function logUnexpectedError(error: unknown): void {
  // Called from route `catch` blocks: must never throw.
  try {
    // No `status` here: the accompanying api.request line carries the status the
    // route actually returned (500 from authErrorResponse, 503 from health/courses).
    emit("error", {
      event: "api.error",
      route: currentRoute(),
      ...describeError(error),
    });
  } catch {
    // A hostile getter / exotic thrown value must not escape the logger.
  }
}

function logRequest(state: RequestContext, status: number, durationMs: number): void {
  const ms = roundMs(durationMs);
  const slow = ms >= SLOW_API_MS;
  emit(slow ? "warn" : "info", {
    event: "api.request",
    route: state.route,
    method: state.method,
    status,
    ms,
    dbMs: roundMs(state.dbMs),
    dbQueries: state.dbQueries,
    ...(state.slowestDbMs > 0 ? { slowestDbMs: roundMs(state.slowestDbMs) } : {}),
    ...(state.failedQueries > 0 ? { failedDbQueries: state.failedQueries } : {}),
    ...(slow ? { slow: true, slowThresholdMs: SLOW_API_MS } : {}),
  });
}

function applyServerTiming(response: Response, state: RequestContext, durationMs: number): void {
  try {
    const dbMetric = `db;dur=${roundMs(state.dbMs)};desc="${state.dbQueries}q"`;
    const appMetric = `app;dur=${roundMs(durationMs)}`;
    const existing = response.headers.get("Server-Timing");
    response.headers.set(
      "Server-Timing",
      existing ? `${existing}, ${dbMetric}, ${appMetric}` : `${dbMetric}, ${appMetric}`,
    );
  } catch {
    // Immutable or streamed responses cannot take extra headers; timing is still logged.
  }
}

/**
 * Wraps a route handler with timing, structured logging and a Server-Timing header.
 * Response bodies, status codes and headers pass through untouched.
 */
export function withApiTiming<Context = unknown>(
  route: string,
  handler: (request: Request, context: Context) => Promise<Response> | Response,
): (request: Request, context?: Context) => Promise<Response> {
  const method = route.split(" ")[0]?.toUpperCase() ?? "GET";

  return async (request: Request, context?: Context): Promise<Response> => {
    const state: RequestContext = {
      route,
      method,
      startedAt: performance.now(),
      dbMs: 0,
      dbQueries: 0,
      slowestDbMs: 0,
      failedQueries: 0,
    };

    let response: Response;
    try {
      response = await requestContext.run(state, () => handler(request, context as Context));
    } catch (error) {
      logRequest(state, 500, performance.now() - state.startedAt);
      // Re-enter the context: once `run` has rejected, the store is empty again,
      // so without this the error line would lose its route label.
      requestContext.run(state, () => logUnexpectedError(error));
      throw error;
    }

    const durationMs = performance.now() - state.startedAt;
    logRequest(state, response.status, durationMs);
    applyServerTiming(response, state, durationMs);
    return response;
  };
}
