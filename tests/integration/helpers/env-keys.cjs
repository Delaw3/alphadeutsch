// Single source of truth for the integration-test environment contract.
//
// Loaded by the CommonJS preload (tests/integration/preload.cjs) and, through
// createRequire(), by the ESM helpers, the guard and scripts/run-auth-integration.mjs.
//
// `MANAGED_ENV_KEYS` may only be supplied by .env.local: the preload deletes any
// inherited value *before* the file is read, so an exported production DB_HOST
// can never silently replace the local one.
//
// `SMTP_ENV_KEYS` are deleted *after* the file is read, so no integration test
// can build a real mail transport whichever values the developer has exported
// or saved.

/** Database settings that must come from .env.local. */
const DATABASE_ENV_KEYS = Object.freeze([
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
]);

/** Exact @@server_uuid of the local MySQL server; required before any write. */
const SERVER_UUID_ENV = "INTEGRATION_EXPECTED_SERVER_UUID";

/** Must come from .env.local; inherited values are dropped, never merged. */
const MANAGED_ENV_KEYS = Object.freeze([...DATABASE_ENV_KEYS, SERVER_UUID_ENV]);

/** Removed after .env.local is read: integration tests never send e-mail. */
const SMTP_ENV_KEYS = Object.freeze([
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "SMTP_FROM_NAME",
]);

/**
 * Forced after the file read. ALLOW_LOCAL_DB_INTEGRATION_TESTS is deliberately
 * absent: only `--allow-local-db` may set it, so running a test file directly
 * stays impossible.
 */
const FORCED_ENV = Object.freeze({
  NODE_ENV: "test",
  AUTH_STORE: "mysql",
  AUTH_EMAIL_PROVIDER: "dev",
});

module.exports = {
  DATABASE_ENV_KEYS,
  SERVER_UUID_ENV,
  MANAGED_ENV_KEYS,
  SMTP_ENV_KEYS,
  FORCED_ENV,
};
