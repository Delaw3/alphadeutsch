// Environment snapshot for the opt-in MySQL integration tests.
//
// `loadIntegrationEnv()` re-uses tests/integration/preload.cjs, which
//   - drops inherited database/SMTP variables before reading .env.local,
//   - loads .env.local,
//   - forces NODE_ENV/AUTH_STORE/AUTH_EMAIL_PROVIDER after that load,
//   - removes every SMTP variable.
// It then refuses to continue unless every database value came from the file.
// Nothing here logs or returns a value to a report.

import { createRequire } from "node:module";

import { assertEnvironmentProvenance } from "./guard.mjs";

const require = createRequire(import.meta.url);

const ENV_KEYS = Object.freeze([
  "NODE_ENV",
  "AUTH_STORE",
  "AUTH_EMAIL_PROVIDER",
  "AUTH_CODE_PEPPER",
  "AUTH_REQUIRE_EMAIL_VERIFY",
  "ALLOW_LOCAL_DB_INTEGRATION_TESTS",
  "INTEGRATION_EXPECTED_SERVER_UUID",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
]);

function snapshot(env) {
  const result = {};
  for (const key of ENV_KEYS) {
    if (typeof env[key] === "string") result[key] = env[key];
  }
  return result;
}

/**
 * The provenance recorded by the preload: which keys were inherited (and
 * dropped), which came from .env.local, and which SMTP keys were suppressed.
 */
export function readIntegrationProvenance() {
  return require("../preload.cjs").provenance;
}

/**
 * Loads the preload (idempotent), refuses an inherited database configuration,
 * and returns a plain snapshot of the integration environment. The snapshot
 * contains DB_PASSWORD; never print it.
 */
export function loadIntegrationEnv() {
  const preload = require("../preload.cjs");
  const env = snapshot(process.env);
  assertEnvironmentProvenance(env, preload.provenance);
  return env;
}

/** The subset needed to create the test-owned pool. Never log the result. */
export function readDbConfig(env) {
  return {
    host: env.DB_HOST.trim(),
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD ?? "",
    database: env.DB_NAME.trim(),
  };
}

/** Safe target description for diagnostics: no credentials, no pepper. */
export function describeTarget(env) {
  return {
    host: env.DB_HOST.trim(),
    port: Number(env.DB_PORT),
    database: env.DB_NAME.trim(),
  };
}
