import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../auth/preload.cjs");
const { resolveAuthStoreKind, validateDbConfig } = require("../build/auth/auth-store-config.js");

describe("AUTH_STORE configuration", () => {
  it("uses memory store when NODE_ENV=test", () => {
    assert.equal(resolveAuthStoreKind({ NODE_ENV: "test" }), "memory");
    assert.equal(resolveAuthStoreKind({ NODE_ENV: "test", AUTH_STORE: "memory" }), "memory");
  });

  it("defaults to mysql in non-test environments", () => {
    assert.equal(resolveAuthStoreKind({ NODE_ENV: "production" }), "mysql");
    assert.equal(resolveAuthStoreKind({ NODE_ENV: "development" }), "mysql");
    assert.equal(resolveAuthStoreKind({ NODE_ENV: "production", AUTH_STORE: "mysql" }), "mysql");
  });

  it("rejects AUTH_STORE=memory when NODE_ENV is not test", () => {
    assert.throws(
      () => resolveAuthStoreKind({ NODE_ENV: "production", AUTH_STORE: "memory" }),
      (e) => e.message.includes("AUTH_STORE=memory is only permitted when NODE_ENV=test")
    );

    assert.throws(
      () => resolveAuthStoreKind({ NODE_ENV: "development", AUTH_STORE: "memory" }),
      (e) => e.message.includes("AUTH_STORE=memory is only permitted when NODE_ENV=test")
    );
  });

  it("throws clear error when DB config is missing", () => {
    assert.throws(
      () => validateDbConfig({ DB_PORT: "3306" }),
      (e) =>
        e.message.includes("Missing or invalid database configuration") &&
        e.message.includes("DB_HOST") &&
        e.message.includes("DB_USER") &&
        e.message.includes("DB_NAME")
    );
  });

  it("passes when DB config is valid", () => {
    assert.doesNotThrow(() =>
      validateDbConfig({
        DB_HOST: "localhost",
        DB_PORT: "3306",
        DB_USER: "user",
        DB_NAME: "dbname",
      })
    );
  });
});
