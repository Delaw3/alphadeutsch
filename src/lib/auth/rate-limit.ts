/**
 * Single-instance sliding-window rate limiter (dev-grade).
 * Production needs a shared store (Redis/DB); this is documented as a
 * Phase B local-foundation limitation. Pure logic — injectable clock.
 */

export type RateLimitDecision = { allowed: boolean; retryAfterMs: number };

export type RateLimitBucket = {
  limit: number;
  windowMs: number;
  hits: number[];
};

export function createBucket(limit: number, windowMs: number): RateLimitBucket {
  return { limit, windowMs, hits: [] };
}

export function checkRateLimit(
  bucket: RateLimitBucket,
  now = Date.now(),
): RateLimitDecision {
  bucket.hits = bucket.hits.filter((t) => now - t < bucket.windowMs);
  if (bucket.hits.length >= bucket.limit) {
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, retryAfterMs: Math.max(0, bucket.windowMs - (now - oldest)) };
  }
  bucket.hits.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export class MemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string, now = Date.now()): RateLimitDecision {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = createBucket(this.limit, this.windowMs);
      this.buckets.set(key, bucket);
    }
    return checkRateLimit(bucket, now);
  }

  reset(key?: string): void {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}

/** Presets used by auth endpoints (per IP + purpose key). */
export const RATE_LIMITS = {
  signup: { limit: 5, windowMs: 10 * 60_000 },
  signin: { limit: 8, windowMs: 10 * 60_000 },
  verify: { limit: 10, windowMs: 10 * 60_000 },
  resend: { limit: 3, windowMs: 10 * 60_000 },
} as const;
