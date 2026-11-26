/* global console, process, setTimeout */
// Opt-in runner for the MySQL OTP integration tests.
//
// The database is only touched by the test files after their guard passes.
// This runner:
//   - refuses to start without --allow-local-db,
//   - strips inherited database/SMTP variables so .env.local is authoritative,
//   - refuses to run against a stale or incomplete auth test build,
//   - forwards SIGINT/SIGTERM to the child so its cleanup hooks can finish,
//   - never prints credentials, and runs files serially (concurrency is
//     exercised inside tests).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { MANAGED_ENV_KEYS, SMTP_ENV_KEYS, FORCED_ENV } = require("../tests/integration/helpers/env-keys.cjs");

const ROOT = resolve(import.meta.dirname, "..");
const FLAG = "--allow-local-db";
const INTEGRATION_DIR = resolve(ROOT, "tests", "integration");
const BUILD_DIR = resolve(ROOT, "tests", "build", "auth");
const TSCONFIG = resolve(ROOT, "tsconfig.auth-tests.json");
const ENV_FILE = resolve(ROOT, ".env.local");
const MYSQL2_MANIFEST = resolve(ROOT, "node_modules", "mysql2", "package.json");
const TEST_TIMEOUT_MS = 30000;
const SIGNAL_GRACE_MS = 20000;

/**
 * The driver build the integration tests are validated against. `package.json`
 * keeps a caret range for the application, so the suite checks the installed
 * version instead: parseDateTime/timezone behaviour is version-specific.
 */
const REQUIRED_MYSQL2_VERSION = "3.24.5";

/** Manual recovery procedure when a run is killed before its cleanup hooks. */
const CLEANUP_DOC = "docs/integration-test-cleanup.md";

/** Every compiled module the integration test files require. */
const REQUIRED_BUILD_MODULES = [
  "auth-errors.js",
  "auth-service.js",
  "dev-mailer.js",
  "email-provider.js",
  "mysql-challenges.js",
  "mysql-users.js",
  "otp.js",
  "sessions.js",
  "smtp-mailer.js",
  "verification.js",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readMysql2Version() {
  try {
    return String(JSON.parse(readFileSync(MYSQL2_MANIFEST, "utf8")).version ?? "");
  } catch {
    return "";
  }
}

function newestMtime(files) {
  let newest = 0;
  for (const file of files) {
    try {
      const { mtimeMs } = statSync(file);
      if (mtimeMs > newest) newest = mtimeMs;
    } catch {
      // A missing source file cannot make the build stale; tsc reports it.
    }
  }
  return newest;
}

function oldestMtime(files) {
  let oldest = Infinity;
  for (const file of files) {
    try {
      const { mtimeMs } = statSync(file);
      if (mtimeMs < oldest) oldest = mtimeMs;
    } catch {
      return 0;
    }
  }
  return Number.isFinite(oldest) ? oldest : 0;
}

/** The files `tsc -p tsconfig.auth-tests.json` compiles (read-only). */
function compiledSourceFiles() {
  try {
    const tsconfig = JSON.parse(readFileSync(TSCONFIG, "utf8"));
    const include = Array.isArray(tsconfig.include) ? tsconfig.include : [];
    return include
      .filter((entry) => typeof entry === "string" && !entry.includes("*"))
      .map((entry) => resolve(ROOT, entry));
  } catch {
    return [];
  }
}

if (!process.argv.slice(2).includes(FLAG)) {
  fail(
    "Refusing to run MySQL integration tests without --allow-local-db.\n" +
      "Usage: npm run test:auth:integration -- --allow-local-db",
  );
}
if (!existsSync(ENV_FILE)) {
  fail("Integration tests require .env.local with local MySQL settings.");
}

const installedMysql2 = readMysql2Version();
if (installedMysql2 !== REQUIRED_MYSQL2_VERSION) {
  fail(
    `Integration tests are validated against mysql2 ${REQUIRED_MYSQL2_VERSION}; ` +
      `the installed driver is ${installedMysql2 || "unreadable"}.\n` +
      "Reinstall the pinned driver version before running these tests.",
  );
}

const missingModules = REQUIRED_BUILD_MODULES.filter(
  (name) => !existsSync(resolve(BUILD_DIR, name)),
);
if (missingModules.length > 0) {
  fail(
    `Auth test build is incomplete (missing ${missingModules.join(", ")}).\n` +
      "Run: npm run test:auth:build",
  );
}

const newestSource = newestMtime([...compiledSourceFiles(), TSCONFIG]);
const oldestBuild = oldestMtime(REQUIRED_BUILD_MODULES.map((name) => resolve(BUILD_DIR, name)));
if (newestSource > 0 && oldestBuild > 0 && newestSource > oldestBuild) {
  fail("Auth test build is stale (tests/build/auth is older than the sources).\nRun: npm run test:auth:build");
}

const files = readdirSync(INTEGRATION_DIR)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => resolve(INTEGRATION_DIR, name));

if (files.length === 0) {
  fail("No integration test files were found.");
}

// The parent environment may carry a production DB_HOST or real SMTP
// credentials; neither may reach the child. The preload enforces the same rule
// again, so both entry points behave identically.
const childEnv = { ...process.env, ...FORCED_ENV, ALLOW_LOCAL_DB_INTEGRATION_TESTS: "1" };
for (const key of [...MANAGED_ENV_KEYS, ...SMTP_ENV_KEYS]) delete childEnv[key];

console.log(
  `Running ${files.length} OTP integration test file(s) with the local-database guard enabled ` +
    `(mysql2 ${installedMysql2}, Node ${process.version}).`,
);

const child = spawn(
  process.execPath,
  [
    "--test",
    "--test-concurrency=1",
    `--test-timeout=${TEST_TIMEOUT_MS}`,
    ...files,
  ],
  { cwd: ROOT, env: childEnv, stdio: "inherit" },
);

// Forward instead of dying: the child's `after()`/signal cleanup hooks get a
// bounded window to delete the rows they created before the process goes away.
let signalled = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (signalled) return;
    signalled = true;
    console.error(`Received ${signal}; forwarding it so test cleanup can finish.`);
    console.error(
      `If this run is killed before its cleanup hooks complete, follow ${CLEANUP_DOC} ` +
        "to remove this run's rows by id and exact e-mail address.",
    );
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      process.exit(1);
    }, SIGNAL_GRACE_MS).unref();
  });
}

child.on("error", (error) => {
  fail(`Unable to start the integration test runner: ${error.message}`);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Integration test runner stopped by ${signal}.`);
    process.exit(1);
  }
  process.exit(code === null ? 1 : code);
});
