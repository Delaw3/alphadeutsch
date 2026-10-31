import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../auth/preload.cjs");
const { hashPassword, isBcryptHash, verifyPassword } = require("../build/auth/passwords.js");
const { normalizeEmail, validateNewPassword, validateDisplayName, normalizeDob } = require("../build/auth/auth-errors.js");

describe("password hashing", () => {
  it("hashes and verifies with low test cost", async () => {
    const hash = await hashPassword("Str0ng!Passw0rd", 4);
    assert.equal(isBcryptHash(hash), true);
    assert.equal(await verifyPassword("Str0ng!Passw0rd", hash), true);
    assert.equal(await verifyPassword("Wrong!Pass1234", hash), false);
  });

  it("rejects malformed and empty hashes without throwing", async () => {
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
    assert.equal(await verifyPassword("anything", ""), false);
    assert.equal(await verifyPassword("anything", "   "), false);
    assert.equal(await verifyPassword("", ""), false);
  });
});

describe("input validation", () => {
  it("normalizes email", () => {
    assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
    assert.equal(normalizeEmail("bad-email"), null);
    assert.equal(normalizeEmail(123), null);
  });

  it("enforces password policy", () => {
    assert.equal(validateNewPassword("Str0ng!Passw0rd").ok, true);
    assert.equal(validateNewPassword("short1!A").ok, false);
    assert.equal(validateNewPassword("nouppercase1!aaaa").ok, false);
    assert.equal(validateNewPassword("NOLOWER1!AAAAA").ok, false);
    assert.equal(validateNewPassword("NoDigits!!AAAA").ok, false);
    assert.equal(validateNewPassword("NoSymbols1AAAAA").ok, false);
  });

  it("validates display names", () => {
    assert.equal(validateDisplayName(" Ada Lovelace "), "Ada Lovelace");
    assert.equal(validateDisplayName("x"), null);
  });

  it("normalizes dob to YYYY-MM-DD", () => {
    assert.equal(normalizeDob("2002-05-09"), "2002-05-09");
    assert.equal(normalizeDob("2002/5/9"), "2002-05-09");
    assert.equal(normalizeDob("09-05-2002"), "2002-05-09");
    assert.equal(normalizeDob("9/5/2002"), "2002-05-09");
    assert.equal(normalizeDob("invalid-date"), null);
    assert.equal(normalizeDob(""), null);
    assert.equal(normalizeDob(null), null);
  });
});
