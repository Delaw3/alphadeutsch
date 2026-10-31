import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../auth/preload.cjs");
const {
  MemorySessionStore, buildSessionCookie, clearSessionCookie,
  createSession, readSessionCookie, requireSessionUser,
  revokeSession, validateSessionToken,
} = require("../build/auth/sessions.js");
const { MemoryRateLimiter, RATE_LIMITS } = require("../build/auth/rate-limit.js");
const { IdentityLinkService } = require("../build/auth/auth-service.js");

describe("sessions", () => {
  it("creates, validates, expires, and revokes", async () => {
    const store = new MemorySessionStore();
    const { token, record } = await createSession(store, { userId: 7, now: 1_000_000 });
    assert.ok(token.length >= 64);
    assert.ok(!("token" in record));

    const valid = await validateSessionToken(store, token, 1_000_001);
    assert.equal(valid?.userId, 7);

    assert.equal(await validateSessionToken(store, null), null);
    assert.equal(await validateSessionToken(store, "short"), null);
    assert.equal(await validateSessionToken(store, "f".repeat(64)), null);
    assert.equal(await validateSessionToken(store, token, record.expiresAt + 1), null);

    assert.equal(await revokeSession(store, token), true);
    assert.equal(await validateSessionToken(store, token), null);
    assert.equal(await revokeSession(store, token), false);
  });

  it("requireSessionUser throws 401 without a session", async () => {
    const store = new MemorySessionStore();
    await assert.rejects(requireSessionUser(store, null), (e) => e.status === 401);
  });

  it("cookies are HttpOnly + SameSite=Lax, Secure in production only", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const prod = buildSessionCookie("abc");
    process.env.NODE_ENV = "development";
    const dev = buildSessionCookie("abc");
    process.env.NODE_ENV = prev;
    assert.match(prod, /HttpOnly/); assert.match(prod, /SameSite=Lax/); assert.match(prod, /Secure/);
    assert.match(dev, /HttpOnly/); assert.ok(!/Secure/.test(dev));
    assert.match(clearSessionCookie(), /Max-Age=0/);
    assert.equal(readSessionCookie("a=1; alphadeutsch_session=tok123; b=2"), "tok123");
    assert.equal(readSessionCookie(null), null);
  });

  it("expired sessions can be cleaned up", async () => {
    const store = new MemorySessionStore();
    await createSession(store, { userId: 1, now: 1000 });
    assert.equal(await store.deleteExpired(1000 + 31 * 24 * 3600 * 1000), 1);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within the window", () => {
    const limiter = new MemoryRateLimiter(2, 60_000);
    assert.equal(limiter.check("k", 0).allowed, true);
    assert.equal(limiter.check("k", 1).allowed, true);
    const blocked = limiter.check("k", 2);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
    assert.equal(limiter.check("k", 61_000).allowed, true);
  });

  it("signin preset allows 8 per 10 minutes", () => {
    const cfg = RATE_LIMITS.signin;
    assert.equal(cfg.limit, 8);
    assert.equal(cfg.windowMs, 600_000);
  });
});

describe("legacy boundary", () => {
  it("legacy linking stays disabled", async () => {
    const svc = new IdentityLinkService();
    assert.equal(await svc.findLegacyStudent(), null);
    const res = await svc.linkExistingStudent();
    assert.equal(res.linked, false);
  });
});
