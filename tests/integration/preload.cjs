// Phase 2B.3 — integration-test bootstrap (CommonJS).
//
// Every integration test file must require this module before loading any
// compiled auth module. It:
//   1. drops inherited database/SMTP variables so .env.local is authoritative,
//   2. loads .env.local (local MySQL settings only; nothing is printed),
//   3. forces the safe integration-test environment AFTER that load,
//   4. removes every SMTP variable so no test can build a real transport,
//   5. installs the server-only stub,
//   6. exports the provenance of every managed variable for the guard to check.
//
// AUTH_CODE_PEPPER is NOT substituted here. The value supplied by the
// environment/.env.local is preserved and its FORMAT is validated by the guard
// (64 hexadecimal characters) without ever being printed or logged.

const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const {
  FORCED_ENV,
  MANAGED_ENV_KEYS,
  SMTP_ENV_KEYS,
} = require("./helpers/env-keys.cjs");

const REPO_ROOT = resolve(__dirname, "..", "..");
const ENV_LOCAL_PATH = resolve(REPO_ROOT, ".env.local");
const ENV_FLAG = "__ALPHADEUTSCH_INTEGRATION_ENV_LOADED__";

/**
 * Provenance of the environment this process actually runs with. The guard
 * refuses to continue unless every managed value came from .env.local.
 */
const provenance = {
  fileLoaded: false,
  envLocalPath: ENV_LOCAL_PATH,
  inheritedKeys: [],
  fromFileKeys: [],
  suppressedSmtpKeys: [],
  pepperSource: "missing",
};

function isSet(key) {
  return Object.prototype.hasOwnProperty.call(process.env, key);
}

/** Removes the given keys and reports which ones were present. */
function strip(keys) {
  const removed = [];
  for (const key of keys) {
    if (!isSet(key)) continue;
    removed.push(key);
    delete process.env[key];
  }
  return removed;
}

/**
 * Installs tests/auth/preload.cjs (server-only stub) without allowing its
 * unit-test pepper fixture to mask a missing integration pepper. Idempotent.
 */
function installServerOnlyStub() {
  const configuredPepper = process.env.AUTH_CODE_PEPPER;
  require("../auth/preload.cjs");
  if (configuredPepper === undefined) {
    delete process.env.AUTH_CODE_PEPPER;
  } else {
    process.env.AUTH_CODE_PEPPER = configuredPepper;
  }
}

function bootstrap() {
  if (typeof process.loadEnvFile !== "function") {
    throw new Error("Integration tests require Node.js 20.12 or newer (process.loadEnvFile).");
  }
  if (!existsSync(ENV_LOCAL_PATH)) {
    throw new Error("Integration tests require .env.local with local MySQL settings.");
  }

  const pepperBeforeLoad = isSet("AUTH_CODE_PEPPER");

  // A value exported by the shell (or a CI job) must never win over the file:
  // drop every inherited managed/SMTP variable before reading .env.local, so the
  // file is the only possible source for the database settings.
  provenance.inheritedKeys = strip([...MANAGED_ENV_KEYS, ...SMTP_ENV_KEYS]);

  try {
    process.loadEnvFile(ENV_LOCAL_PATH);
  } catch {
    // Never echo the parser error: it can contain a line fragment.
    throw new Error("Integration tests could not load .env.local.");
  }

  provenance.fileLoaded = true;
  provenance.fromFileKeys = MANAGED_ENV_KEYS.filter(
    (key) => isSet(key) && String(process.env[key] ?? "").trim() !== "",
  );

  // Safety overrides must run after the file load.
  for (const [key, value] of Object.entries(FORCED_ENV)) {
    process.env[key] = value;
  }

  // No integration test may contact SMTP, whatever .env.local contains.
  provenance.suppressedSmtpKeys = strip(SMTP_ENV_KEYS);

  const pepperAfterLoad = isSet("AUTH_CODE_PEPPER");
  installServerOnlyStub();
  provenance.pepperSource = pepperAfterLoad
    ? pepperBeforeLoad
      ? "environment"
      : "file"
    : "missing";
}

if (process.env[ENV_FLAG] !== "1") {
  bootstrap();
  process.env[ENV_FLAG] = "1";
} else {
  installServerOnlyStub();
}

module.exports = { ENV_LOCAL_PATH, provenance };
