// Pre-write guards for the opt-in MySQL integration tests.
//
// The guard is deliberately independent of .env loading so its pure helpers can
// be unit-tested without touching the environment file. A test file calls:
//
//   assertIntegrationEnvironment(env);       // no connection
//   await assertLoopbackHost(env.DB_HOST);   // DNS only
//   pool = createIntegrationPool(readDbConfig(env));
//   await assertWritableLocalAlphaDeutschTarget(pool, env); // first DB contact
//
// Writes are only allowed after the target database, port, version, server UUID,
// read-only state, account scope, peer address, schema, and the account's
// effective privileges (direct grants + every granted role) have all been
// positively verified. Every check fails closed: a value that cannot be
// verified means no writes.
//
// Privileges are the security boundary: the account must hold nothing but
// SELECT/INSERT/UPDATE/DELETE on the three tables the suites use, with no
// global scope, no other database, no DDL and no GRANT OPTION. The statement
// guard in the test pool (helpers/statement-guard.mjs) is defence in depth on
// top of that, never a substitute for it.

import dns from "node:dns/promises";
import { createRequire } from "node:module";
import { isIP } from "node:net";

const require = createRequire(import.meta.url);

const { MANAGED_ENV_KEYS, SERVER_UUID_ENV, SMTP_ENV_KEYS } = require("./env-keys.cjs");

export const DATABASE_NAME = "alphadeutsch";
export const REQUIRED_MYSQL_VERSION_PREFIX = "9.7.";

/**
 * The only privileges an integration-test account may hold.
 *
 * Anything else — DDL (CREATE/DROP/ALTER/INDEX/REFERENCES/TRIGGER/EVENT), FILE,
 * PROCESS, SUPER, RELOAD, `ALL PRIVILEGES`, GRANT OPTION — is rejected even on
 * the approved database. A loopback connection and a matching server UUID prove
 * *which* server is in use; they say nothing about how far the account can
 * reach, so the privilege set is checked on its own terms.
 */
export const ALLOWED_PRIVILEGES = Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]);

/**
 * The exact operations the suites perform, per table — the complete surface.
 *
 * `sessions` is written by MemorySessionStore, so the only statements that touch
 * it are the cleanup `DELETE ... WHERE user_id = ?` and the post-cleanup
 * `SELECT COUNT(*) ... WHERE user_id = ?`. Requiring INSERT/UPDATE there would
 * demand privileges the tests never use.
 */
export const REQUIRED_TABLE_PRIVILEGES = Object.freeze({
  users: Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]),
  verification_challenges: Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]),
  sessions: Object.freeze(["SELECT", "DELETE"]),
});

export const EXPECTED_SCHEMA = Object.freeze({
  users: Object.freeze(["id", "email", "email_verified_at"]),
  sessions: Object.freeze(["id", "user_id"]),
  verification_challenges: Object.freeze([
    "id",
    "user_id",
    "purpose",
    "code_hash",
    "expires_at",
    "used_at",
    "attempts",
    "created_at",
    "last_sent_at",
  ]),
});

export const PEPPER_PATTERN = /^[0-9a-fA-F]{64}$/;

/** MySQL's canonical `@@server_uuid` form. */
export const SERVER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export { SERVER_UUID_ENV };

export class IntegrationGuardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IntegrationGuardError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new IntegrationGuardError(code, message);
}

/** True only for IPv4 127.0.0.0/8, IPv6 ::1, and IPv4-mapped loopback. */
export function isLoopbackAddress(address) {
  if (typeof address !== "string") return false;
  const value = address.trim();
  if (!value) return false;

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value);
  if (mapped) return isLoopbackAddress(mapped[1]);

  const family = isIP(value);
  if (family === 4) {
    const first = Number(value.split(".")[0]);
    return first === 127;
  }
  if (family === 6) {
    const normalized = value.toLowerCase();
    if (normalized === "::1") return true;
    const groups = normalized.split(":");
    return (
      groups.length === 8 &&
      groups.slice(0, 7).every((group) => /^0+$/.test(group)) &&
      /^0*1$/.test(groups[7])
    );
  }
  return false;
}

/** Parses `user@host` (CURRENT_USER()) without assuming the user lacks '@'. */
export function parseAccount(currentUser) {
  const text = typeof currentUser === "string" ? currentUser : "";
  const at = text.lastIndexOf("@");
  if (at <= 0) return { user: text, host: "" };
  return { user: text.slice(0, at), host: text.slice(at + 1) };
}

/** A MySQL account host (the host part of CURRENT_USER()) pinned to loopback. */
export function isLoopbackAccountHost(host) {
  if (typeof host !== "string") return false;
  const value = host.trim();
  if (!value || value === "%") return false;
  return isLoopbackPeerHost(value);
}

/**
 * Requires CURRENT_USER() to be scoped to a loopback host. Both `%` (any host)
 * and an unparsable account are rejected: a production-style account must never
 * pass for the local integration-test target.
 */
export function assertLocalAccountHost(currentUser) {
  const account = parseAccount(currentUser);
  if (!account.host) {
    fail(
      "TARGET_ACCOUNT_UNVERIFIED",
      "The MySQL account host could not be determined from CURRENT_USER().",
    );
  }
  if (account.host === "%") {
    fail(
      "TARGET_ACCOUNT_NOT_LOOPBACK",
      "The MySQL account is granted to any host ('%'); integration tests require a loopback-scoped account.",
    );
  }
  if (!isLoopbackPeerHost(account.host)) {
    fail("TARGET_ACCOUNT_NOT_LOOPBACK", "The MySQL account is not restricted to a loopback host.");
  }
  return { user: account.user, host: account.host, scope: "loopback" };
}

/**
 * Requires the connected peer to be positively identified as loopback. An
 * unreadable process list is not evidence: the guard fails closed instead of
 * trusting the configuration alone.
 */
export function assertPeerHostVerified(peerHost) {
  if (typeof peerHost !== "string" || peerHost.trim() === "") {
    fail(
      "TARGET_PEER_UNVERIFIED",
      "The MySQL peer address could not be verified; refusing to write.",
    );
  }
  if (!isLoopbackPeerHost(peerHost)) {
    fail("TARGET_PEER_NOT_LOOPBACK", "The MySQL peer address is not loopback.");
  }
  return peerHost.trim();
}

/** True for loopback hosts, optionally written as `host:port` or `[::1]:port`. */
export function isLoopbackPeerHost(hostPort) {
  if (typeof hostPort !== "string") return false;
  let host = hostPort.trim();
  if (!host) return false;

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    host = end > 0 ? host.slice(1, end) : host;
  } else {
    const ipv6LoopbackPort = /^(?:::1|0:0:0:0:0:0:0:1):\d+$/i;
    if (ipv6LoopbackPort.test(host)) {
      host = host.replace(/:\d+$/, "");
    } else {
      const ipv4Port = /^(\d+\.\d+\.\d+\.\d+):\d+$/.exec(host);
      if (ipv4Port) host = ipv4Port[1];
      else if (host.split(":").length === 2 && /:\d+$/.test(host)) {
        host = host.replace(/:\d+$/, "");
      }
    }
  }

  return host.toLowerCase() === "localhost" || isLoopbackAddress(host);
}

/**
 * Requires DB_HOST to be a loopback literal or a hostname that resolves
 * exclusively to loopback addresses. `lookup` is injectable for unit tests.
 */
export async function assertLoopbackHost(host, { lookup = dns.lookup } = {}) {
  const trimmed = typeof host === "string" ? host.trim() : "";
  if (!trimmed) fail("DB_HOST_REQUIRED", "DB_HOST is required for integration tests.");

  const bare = trimmed.replace(/^\[/, "").replace(/\]$/, "");
  if (isIP(bare)) {
    if (!isLoopbackAddress(bare)) {
      fail("DB_HOST_NOT_LOOPBACK", "DB_HOST must resolve only to loopback addresses.");
    }
    return [bare];
  }

  let resolved;
  try {
    resolved = await lookup(bare, { all: true });
  } catch {
    fail("DB_HOST_UNRESOLVED", "DB_HOST could not be resolved.");
  }

  const entries = Array.isArray(resolved) ? resolved : [resolved];
  if (entries.length === 0) fail("DB_HOST_UNRESOLVED", "DB_HOST resolved to no addresses.");

  const addresses = entries.map((entry) =>
    typeof entry === "string" ? entry : entry && entry.address,
  );
  for (const address of addresses) {
    if (!isLoopbackAddress(address)) {
      fail("DB_HOST_NOT_LOOPBACK", "DB_HOST must resolve only to loopback addresses.");
    }
  }
  return addresses;
}

/**
 * Sync, connection-free safety checks. Rejects production mode, the memory
 * store, SMTP delivery, remote-looking configuration, a wrong database name,
 * and a missing/invalid pepper — all before a pool is created.
 */
export function assertIntegrationEnvironment(env) {
  if (!env || typeof env !== "object") {
    fail("ENV_MISSING", "Integration test environment is unavailable.");
  }
  if (env.ALLOW_LOCAL_DB_INTEGRATION_TESTS !== "1") {
    fail(
      "OPT_IN_REQUIRED",
      "Integration tests require --allow-local-db (ALLOW_LOCAL_DB_INTEGRATION_TESTS=1).",
    );
  }
  if (env.NODE_ENV !== "test") {
    fail("NODE_ENV_INVALID", "Integration tests require NODE_ENV=test.");
  }
  if (env.AUTH_STORE !== "mysql") {
    fail("AUTH_STORE_INVALID", "Integration tests require AUTH_STORE=mysql.");
  }
  if (env.AUTH_EMAIL_PROVIDER !== "dev") {
    fail("EMAIL_PROVIDER_INVALID", "Integration tests require AUTH_EMAIL_PROVIDER=dev.");
  }
  if (!PEPPER_PATTERN.test(env.AUTH_CODE_PEPPER ?? "")) {
    fail(
      "PEPPER_INVALID",
      "AUTH_CODE_PEPPER must be exactly 64 hexadecimal characters for integration tests.",
    );
  }

  const host = typeof env.DB_HOST === "string" ? env.DB_HOST.trim() : "";
  if (!host) fail("DB_HOST_REQUIRED", "DB_HOST is required for integration tests.");

  const database = typeof env.DB_NAME === "string" ? env.DB_NAME.trim() : "";
  if (database !== DATABASE_NAME) {
    fail("DB_NAME_INVALID", "Integration tests require DB_NAME=alphadeutsch.");
  }

  const port = Number(env.DB_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    fail("DB_PORT_INVALID", "DB_PORT must be an integer between 1 and 65535.");
  }

  if (typeof env.DB_USER !== "string" || env.DB_USER.trim() === "") {
    fail("DB_USER_REQUIRED", "DB_USER is required for integration tests.");
  }

  const expectedServerUuid =
    typeof env[SERVER_UUID_ENV] === "string" ? env[SERVER_UUID_ENV].trim() : "";
  if (!SERVER_UUID_PATTERN.test(expectedServerUuid)) {
    fail(
      "SERVER_UUID_REQUIRED",
      `${SERVER_UUID_ENV} must be set to the exact @@server_uuid of the local MySQL server.`,
    );
  }

  for (const key of SMTP_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim() !== "") {
      fail(
        "SMTP_CREDENTIALS_PRESENT",
        `${key} must not be set during integration tests; e-mail delivery is stubbed.`,
      );
    }
  }

  return { database, host, port, serverUuid: expectedServerUuid.toLowerCase() };
}

/**
 * Refuses to continue when a database setting did not come from .env.local.
 *
 * `preload.cjs` deletes inherited managed keys *before* the file load, so
 * anything still set afterwards can only come from the file; this asserts that
 * invariant instead of trusting it, and reports which keys were dropped.
 */
export function assertEnvironmentProvenance(env, provenance) {
  if (!provenance || typeof provenance !== "object" || provenance.fileLoaded !== true) {
    fail("ENV_PROVENANCE_UNKNOWN", "The integration environment was not loaded from .env.local.");
  }

  const fromFile = new Set(Array.isArray(provenance.fromFileKeys) ? provenance.fromFileKeys : []);
  for (const key of MANAGED_ENV_KEYS) {
    const value = env[key];
    if (typeof value !== "string" || value.trim() === "") continue;
    if (!fromFile.has(key)) {
      fail(
        "ENV_NOT_FROM_FILE",
        `${key} did not come from .env.local; inherited values are not accepted for integration tests.`,
      );
    }
  }

  const suppressed = new Set(
    Array.isArray(provenance.suppressedSmtpKeys) ? provenance.suppressedSmtpKeys : [],
  );
  for (const key of SMTP_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim() !== "" && !suppressed.has(key)) {
      fail("SMTP_CREDENTIALS_PRESENT", `${key} must not be present during integration tests.`);
    }
  }

  return {
    inheritedKeys: Array.isArray(provenance.inheritedKeys) ? [...provenance.inheritedKeys] : [],
    fromFileKeys: [...fromFile],
    pepperSource: provenance.pepperSource ?? "missing",
  };
}

/** MySQL renders accounts and roles as `` `name`@`host` ``. */
export const ROLE_SPEC_PATTERN = /^`[^`@]{1,255}`@`[^`]{0,255}`$/;

const GRANT_OBJECT_PATTERN = /^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/i;
const GRANT_ROLE_PATTERN = /^GRANT\s+((?:`[^`]*`@`[^`]*`)(?:\s*,\s*`[^`]*`@`[^`]*`)*)\s+TO\s+/i;
const ROLE_ROW_PREFIX = /^GRANT\s+`/i;
const ALL_PRIVILEGES = "ALL PRIVILEGES";

function normalizeGrant(text) {
  return typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
}

/** Roles granted to the account, as `` `role`@`host` `` specs. */
export function parseGrantedRoles(grants) {
  const roles = new Set();
  for (const grant of grants ?? []) {
    const match = GRANT_ROLE_PATTERN.exec(normalizeGrant(grant));
    if (!match) continue;
    for (const part of match[1].split(",")) {
      const spec = part.trim();
      if (ROLE_SPEC_PATTERN.test(spec)) roles.add(spec);
    }
  }
  return [...roles];
}

/**
 * True when every role-style row (`GRANT `role`@`host` TO …`) can be parsed.
 *
 * A role row we cannot read is a privilege set we cannot see, so
 * `assertDmlPrivileges` refuses to continue instead of skipping it.
 */
export function rolesAreFullyParsed(grants) {
  for (const grant of grants ?? []) {
    const text = normalizeGrant(grant);
    if (!ROLE_ROW_PREFIX.test(text)) continue;
    if (!GRANT_ROLE_PATTERN.test(text)) return false;
    const head = text.slice("GRANT ".length, text.indexOf(" TO "));
    for (const spec of head.split(",")) {
      if (!ROLE_SPEC_PATTERN.test(spec.trim())) return false;
    }
  }
  return true;
}

/** Roles active for this session (`CURRENT_ROLE()`; "NONE" when none). */
export function parseActiveRoles(currentRole) {
  if (typeof currentRole !== "string") return [];
  const roles = new Set();
  for (const part of currentRole.split(",")) {
    const spec = part.trim();
    if (ROLE_SPEC_PATTERN.test(spec)) roles.add(spec);
  }
  return [...roles];
}

/** De-duplicated union of grant rows from several sources. */
export function mergeGrants(...lists) {
  const merged = new Set();
  for (const list of lists) {
    for (const grant of list ?? []) {
      const text = normalizeGrant(grant);
      if (text) merged.add(text);
    }
  }
  return [...merged];
}

/** Splits a privilege list, dropping column lists such as `SELECT (`a`, `b`)`. */
function parsePrivileges(text) {
  return text
    .replace(/\([^)]*\)/g, " ")
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " ").toUpperCase())
    .filter(Boolean)
    .map((privilege) => (privilege === "ALL" ? ALL_PRIVILEGES : privilege));
}

function parseGrantObject(text) {
  const raw = text.trim();
  if (/^\*\s*\.\s*\*$/.test(raw)) return { scope: "global" };
  const parts = raw.split(".");
  if (parts.length !== 2) return { scope: "unparseable" };
  const schema = parts[0].trim().replace(/^`|`$/g, "");
  const table = parts[1].trim().replace(/^`|`$/g, "");
  if (schema === "*") return { scope: "global" };
  if (!schema || !table) return { scope: "unparseable" };
  return { scope: table === "*" ? "database" : "table", schema, table };
}

/**
 * Evaluates the *effective* grant rows (direct grants plus every granted role,
 * active or not) against the approved database and the per-table operations the
 * suites need.
 *
 * Rejections are reported, never silently ignored:
 *   GLOBAL_PRIVILEGE        any privilege on `*.*`
 *   WILDCARD_SCOPE          a pattern database scope (e.g. `alphadeutsch%`)
 *   EXCESS_DATABASE         a grant on a database other than the approved one
 *   EXCESS_PRIVILEGE        a privilege outside SELECT/INSERT/UPDATE/DELETE
 *   EXCESS_TABLE            a table grant outside the approved table set
 *   SCHEMA_SCOPE_UNVERIFIED `db`.* without a table inventory to prove minimality
 *   SCHEMA_SCOPE_TOO_BROAD  `db`.* while the schema holds tables the tests never use
 *   GRANT_OPTION            WITH GRANT OPTION
 *   UNPARSEABLE_GRANT       a row that cannot be attributed to a scope
 */
export function evaluateGrants(
  grants,
  { database = DATABASE_NAME, required = REQUIRED_TABLE_PRIVILEGES, schemaTables = null } = {},
) {
  const approvedDatabase = String(database ?? "").trim().toUpperCase();
  const requiredTables = Object.keys(required);
  const requiredNormalized = new Map(
    requiredTables.map((table) => [table, (required[table] ?? []).map((p) => String(p).toUpperCase())]),
  );
  const coverage = new Map(requiredTables.map((table) => [table, new Set()]));
  const violations = [];
  const seen = new Set();
  let usedSchemaScope = false;

  const report = (code, detail) => {
    const key = `${code}:${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ code, detail });
  };

  for (const grant of grants ?? []) {
    const text = normalizeGrant(grant);
    if (!text) continue;

    if (/WITH GRANT OPTION\s*$/i.test(text)) {
      report("GRANT_OPTION", "WITH GRANT OPTION");
    }
    // A role row confers nothing by itself; its privileges are merged in from
    // SHOW GRANTS ... USING before this function is called.
    if (GRANT_ROLE_PATTERN.test(text)) continue;

    const match = GRANT_OBJECT_PATTERN.exec(text);
    if (!match) {
      report("UNPARSEABLE_GRANT", "a grant row could not be attributed to a scope");
      continue;
    }

    const privileges = parsePrivileges(match[1]).filter((privilege) => privilege !== "USAGE");
    if (privileges.length === 0) continue; // GRANT USAGE grants nothing

    const object = parseGrantObject(match[2]);
    if (object.scope === "global") {
      report("GLOBAL_PRIVILEGE", `on *.* (${privileges.join(", ")})`);
      continue;
    }
    if (object.scope === "unparseable") {
      report("UNPARSEABLE_GRANT", "a grant row could not be attributed to a scope");
      continue;
    }
    if (object.schema.toUpperCase() !== approvedDatabase) {
      report(
        /[%_]/.test(object.schema) ? "WILDCARD_SCOPE" : "EXCESS_DATABASE",
        `on a database other than ${DATABASE_NAME}`,
      );
      continue;
    }

    const acceptable = [];
    for (const privilege of privileges) {
      if (ALLOWED_PRIVILEGES.includes(privilege)) {
        acceptable.push(privilege);
      } else {
        report("EXCESS_PRIVILEGE", `${privilege} is outside ${ALLOWED_PRIVILEGES.join("/")}`);
      }
    }
    if (acceptable.length === 0) continue;

    if (object.scope === "database") {
      // A database-wide grant is only "minimum necessary" when the schema holds
      // nothing but the tables the tests use; that inventory must be proven.
      if (schemaTables === null || schemaTables === undefined) {
        report("SCHEMA_SCOPE_UNVERIFIED", "database-wide grant without a table inventory");
        continue;
      }
      const outside = schemaTables
        .map((table) => String(table).toLowerCase())
        .filter((table) => !requiredTables.includes(table));
      if (outside.length > 0) {
        report("SCHEMA_SCOPE_TOO_BROAD", "database-wide grant reaches tables the tests do not use");
        continue;
      }
      usedSchemaScope = true;
      for (const table of requiredTables) {
        for (const privilege of acceptable) coverage.get(table).add(privilege);
      }
      continue;
    }

    const table = object.table.toLowerCase();
    if (!coverage.has(table)) {
      report("EXCESS_TABLE", `on table ${table}`);
      continue;
    }
    for (const privilege of acceptable) coverage.get(table).add(privilege);
  }

  const missing = [];
  for (const table of requiredTables) {
    for (const privilege of requiredNormalized.get(table)) {
      if (!coverage.get(table).has(privilege)) missing.push(`${table}.${privilege}`);
    }
  }

  return {
    ok: violations.length === 0 && missing.length === 0,
    missing,
    violations,
    grantScope: usedSchemaScope ? "database" : "table",
  };
}

async function readPeerHost(pool, connectionId) {
  try {
    const [rows] = await pool.query(
      "SELECT HOST FROM performance_schema.processlist WHERE ID = ?",
      [connectionId],
    );
    if (rows[0] && rows[0].HOST) return rows[0].HOST;
  } catch {
    // performance_schema can be disabled or restricted; fall back below.
  }
  try {
    const [rows] = await pool.query("SHOW PROCESSLIST");
    const peer = rows.find((row) => Number(row.Id) === Number(connectionId));
    if (peer && peer.Host) return peer.Host;
  } catch {
    // Both lookups failed: `assertPeerHostVerified` turns that into a refusal.
  }
  return null;
}

/** Verifies database name, port, version, read-write state and peer address. */
export async function verifyDatabaseTarget(pool, env) {
  const [rows] = await pool.query(
    "SELECT DATABASE() AS db, @@port AS port, @@version AS version, " +
      "@@version_comment AS versionComment, CURRENT_USER() AS currentUser, " +
      "@@read_only AS readOnly, @@super_read_only AS superReadOnly, " +
      "@@server_uuid AS serverUuid, CONNECTION_ID() AS connectionId",
  );
  const row = rows[0];
  if (!row) fail("TARGET_UNKNOWN", "The MySQL target could not be identified.");

  const database = String(row.db ?? "");
  if (database !== DATABASE_NAME) {
    fail("TARGET_DATABASE_MISMATCH", "The connected database is not alphadeutsch.");
  }

  const port = Number(row.port);
  if (port !== Number(env.DB_PORT)) {
    fail("TARGET_PORT_MISMATCH", "The connected MySQL port does not match DB_PORT.");
  }

  const version = String(row.version ?? "");
  if (!version.startsWith(REQUIRED_MYSQL_VERSION_PREFIX)) {
    fail(
      "TARGET_VERSION_MISMATCH",
      `Integration tests require MySQL 9.7; the connected server reported ${
        version || "an unknown version"
      }.`,
    );
  }

  if (Number(row.readOnly) !== 0 || Number(row.superReadOnly) !== 0) {
    fail("TARGET_READ_ONLY", "The MySQL target is read-only; integration writes are blocked.");
  }

  // A loopback host/peer cannot tell a local server from an SSH tunnel that
  // forwards a remote one. The server UUID is the only value a tunnel cannot
  // fake, so an exact match is required before any write.
  const expectedServerUuid =
    typeof env[SERVER_UUID_ENV] === "string" ? env[SERVER_UUID_ENV].trim().toLowerCase() : "";
  if (!SERVER_UUID_PATTERN.test(expectedServerUuid)) {
    fail(
      "SERVER_UUID_REQUIRED",
      `${SERVER_UUID_ENV} must be set to the exact @@server_uuid of the local MySQL server.`,
    );
  }
  const serverUuid = String(row.serverUuid ?? "").trim().toLowerCase();
  if (serverUuid !== expectedServerUuid) {
    fail(
      "TARGET_SERVER_UUID_MISMATCH",
      `The connected MySQL server UUID does not match ${SERVER_UUID_ENV}; refusing to write.`,
    );
  }

  const account = assertLocalAccountHost(row.currentUser);
  const peerHost = assertPeerHostVerified(await readPeerHost(pool, row.connectionId));

  return {
    writesAllowed: true,
    database,
    port,
    version,
    serverUuid,
    peerCheck: "loopback",
    peerHost,
    accountScope: account.scope,
  };
}

/** Migration 004's table and every column the store reads/writes must exist. */
export async function assertSchemaPresent(pool) {
  const tableNames = Object.keys(EXPECTED_SCHEMA);
  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await pool.query(
    "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName " +
      "FROM information_schema.COLUMNS " +
      `WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    tableNames,
  );

  const present = new Map(tableNames.map((table) => [table, new Set()]));
  for (const row of rows) {
    const table = String(row.tableName).toLowerCase();
    const column = String(row.columnName).toLowerCase();
    if (present.has(table)) present.get(table).add(column);
  }

  const missing = [];
  for (const [table, columns] of Object.entries(EXPECTED_SCHEMA)) {
    for (const column of columns) {
      if (!present.get(table).has(column)) missing.push(`${table}.${column}`);
    }
  }
  if (missing.length > 0) {
    fail("SCHEMA_MISSING", `Missing required schema: ${missing.join(", ")}.`);
  }
}

/** Reads every string cell of a SHOW GRANTS result (column name varies). */
async function readGrantRows(pool, sql) {
  const [rows] = await pool.query(sql);
  const grants = [];
  for (const row of rows ?? []) {
    for (const value of Object.values(row ?? {})) {
      if (typeof value === "string") grants.push(value);
    }
  }
  return grants;
}

/** Every base table/view in the connected schema (no table privilege needed). */
async function readSchemaTableNames(pool) {
  const [rows] = await pool.query(
    "SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  );
  return (rows ?? [])
    .map((row) => String(row.tableName ?? "").toLowerCase())
    .filter(Boolean);
}

/**
 * Requires the account's *effective* privileges — its direct grants plus every
 * role granted to it, active or not (an inactive role can be enabled with
 * `SET ROLE` at any time) — to be no more than the DML the suites need on the
 * tables they use. Global grants, wildcard database scopes, other databases,
 * DDL, `ALL PRIVILEGES`, and GRANT OPTION are all rejections.
 *
 * Returns `{ grantScope, grantedRoles, inactiveRoles }` for the caller's report.
 */
export async function assertDmlPrivileges(pool) {
  const direct = await readGrantRows(pool, "SHOW GRANTS FOR CURRENT_USER()");

  // A role row that cannot be parsed is a privilege set we cannot see: fail
  // closed rather than evaluating an incomplete picture.
  if (!rolesAreFullyParsed(direct)) {
    fail(
      "ROLE_PRIVILEGES_UNVERIFIED",
      "A role granted to the account could not be parsed; refusing to write.",
    );
  }

  const grantedRoles = parseGrantedRoles(direct);

  const [roleRows] = await pool.query("SELECT CURRENT_ROLE() AS currentRole");
  const activeRoles = parseActiveRoles(roleRows?.[0]?.currentRole);
  const inactiveRoles = grantedRoles.filter((role) => !activeRoles.includes(role));

  let roleGrants = [];
  if (grantedRoles.length > 0) {
    try {
      // The canonical view of effective privileges. Role specs are MySQL's own
      // rendering and were validated against ROLE_SPEC_PATTERN above, so this
      // cannot be influenced by an attacker-controlled identifier.
      roleGrants = await readGrantRows(
        pool,
        `SHOW GRANTS FOR CURRENT_USER() USING ${grantedRoles.join(", ")}`,
      );
    } catch {
      fail(
        "ROLE_PRIVILEGES_UNVERIFIED",
        "The privileges of the account's roles could not be read; refusing to write.",
      );
    }
  }

  const schemaTables = await readSchemaTableNames(pool);
  const evaluation = evaluateGrants(mergeGrants(direct, roleGrants), {
    database: DATABASE_NAME,
    required: REQUIRED_TABLE_PRIVILEGES,
    schemaTables,
  });

  if (!evaluation.ok) {
    const reasons = evaluation.violations.map((violation) => violation.code);
    if (evaluation.missing.length > 0) {
      reasons.push(`missing ${evaluation.missing.join(", ")}`);
    }
    fail(
      "PRIVILEGES_REJECTED",
      `The MySQL account is not suitable for integration tests: ${reasons.join("; ")}.`,
    );
  }

  return {
    grantScope: evaluation.grantScope,
    grantedRoles: grantedRoles.length,
    inactiveRoles: inactiveRoles.length,
  };
}

/**
 * Full pre-write gate. Must complete before the first INSERT/UPDATE/DELETE in a
 * test file. Returns a sanitized target description that includes the verified
 * privilege scope.
 */
export async function assertWritableLocalAlphaDeutschTarget(pool, env) {
  assertIntegrationEnvironment(env);
  await assertLoopbackHost(env.DB_HOST);
  const target = await verifyDatabaseTarget(pool, env);
  await assertSchemaPresent(pool);
  const privileges = await assertDmlPrivileges(pool);
  return { ...target, privileges };
}
