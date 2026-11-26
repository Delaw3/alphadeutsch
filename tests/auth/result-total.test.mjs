import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { skillTotal, resolveResultTotal } = require("../build/results.js");

/** Mirrors the live legacy row that showed "Total 0" next to real scores. */
function row(overrides = {}) {
  return {
    horen_score: 23,
    lesen_score: 15,
    schreiben_score: 16,
    sprechen_score: 14,
    total_score: 0,
    ...overrides,
  };
}

describe("result totals", () => {
  it("sums the four skills when the stored total is the legacy 0", () => {
    assert.equal(resolveResultTotal(row()), 68);
  });

  it("keeps a positive stored total: the school's figure wins", () => {
    assert.equal(resolveResultTotal(row({ total_score: 70 })), 70);
  });

  it("sums the skills when the stored total is null", () => {
    assert.equal(resolveResultTotal(row({ total_score: null })), 68);
  });

  it("never reports a total when a skill is missing", () => {
    assert.equal(resolveResultTotal(row({ sprechen_score: null })), null);
    assert.equal(resolveResultTotal(row({ horen_score: null })), null);
    assert.equal(skillTotal(row({ lesen_score: null })), null);
  });

  it("rounds FLOAT noise to two decimals", () => {
    assert.equal(
      skillTotal(row({ horen_score: 23.4, lesen_score: 15.35, schreiben_score: 16.25, sprechen_score: 13 })),
      68,
    );
    assert.equal(skillTotal(row({ horen_score: 0.1, lesen_score: 0.2, schreiben_score: 0, sprechen_score: 0 })), 0.3);
  });

  it("treats a zero total without skills as unknown rather than 0", () => {
    assert.equal(
      resolveResultTotal({
        horen_score: null,
        lesen_score: null,
        schreiben_score: null,
        sprechen_score: null,
        total_score: 0,
      }),
      null,
    );
  });

  it("derives the sum on percentage-marked courses too (total out of 400)", () => {
    // Courses 3/4/5 mark each skill out of 100; the school's own stored totals
    // there are sums (169–333), so a missing total is derived the same way.
    const percentage = {
      horen_score: 54,
      lesen_score: 67,
      schreiben_score: 100,
      sprechen_score: 32,
      total_score: 0,
    };
    assert.equal(resolveResultTotal(percentage), 253);
    assert.equal(resolveResultTotal({ ...percentage, total_score: 253 }), 253);
  });

  it("derives totals at and above the 25-per-skill boundary", () => {
    assert.equal(
      resolveResultTotal({
        horen_score: 25,
        lesen_score: 25,
        schreiben_score: 25,
        sprechen_score: 25,
        total_score: 0,
      }),
      100,
    );
    assert.equal(
      resolveResultTotal({
        horen_score: 26,
        lesen_score: 0,
        schreiben_score: 0,
        sprechen_score: 0,
        total_score: 0,
      }),
      26,
    );
  });
});
