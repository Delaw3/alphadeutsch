// Pure guard tests: no database connection, no .env.local read.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_PRIVILEGES,
  IntegrationGuardError,
  REQUIRED_TABLE_PRIVILEGES,
  SERVER_UUID_ENV,
  assertEnvironmentProvenance,
  assertIntegrationEnvironment,
  assertLocalAccountHost,
  assertLoopbackHost,
  assertPeerHostVerified,
  evaluateGrants,
  isLoopbackAccountHost,
  isLoopbackAddress,
  isLoopbackPeerHost,
  mergeGrants,
  parseAccount,
  parseActiveRoles,
  parseGrantedRoles,
  rolesAreFullyParsed,
} from "./helpers/guard.mjs";
import { ProtectedStatementError, assertSafeStatement } from "./helpers/statement-guard.mjs";

const TEST_SERVER_UUID = "3f2b8c1e-9a44-11ee-8c90-0242ac120002";

function baseEnv(overrides = {}) {
  return {
    ALLOW_LOCAL_DB_INTEGRATION_TESTS: "1",
    NODE_ENV: "test",
    AUTH_STORE: "mysql",
    AUTH_EMAIL_PROVIDER: "dev",
    AUTH_CODE_PEPPER: "a".repeat(64),
    [SERVER_UUID_ENV]: TEST_SERVER_UUID,
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "integration-tester",
    DB_PASSWORD: "",
    DB_NAME: "alphadeutsch",
    ...overrides,
  };
}

/** Mirrors the provenance object preload.cjs publishes. */
function provenance(overrides = {}) {
  return {
    fileLoaded: true,
    inheritedKeys: [],
    fromFileKeys: ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", SERVER_UUID_ENV],
    suppressedSmtpKeys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"],
    pepperSource: "file",
    ...overrides,
  };
}

function fakeLookup(addresses) {
  return async () =>
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }));
}

function hasCode(code) {
  return (error) => error instanceof IntegrationGuardError && error.code === code;
}

describe("guard: loopback addresses", () => {
  it("accepts every IPv4 loopback and IPv6 ::1 form", () => {
    for (const address of [
      "127.0.0.1",
      "127.1.2.3",
      "::1",
      "0:0:0:0:0:0:0:1",
      "::ffff:127.0.0.1",
    ]) {
      assert.equal(isLoopbackAddress(address), true, address);
    }
  });

  it("rejects wildcard, LAN, public and malformed addresses", () => {
    for (const address of [
      "0.0.0.0",
      "::",
      "10.0.0.5",
      "192.168.1.10",
      "8.8.8.8",
      "127.0.0.1.example.com",
      "localhost",
      "",
    ]) {
      assert.equal(isLoopbackAddress(address), false, address);
    }
  });

  it("understands peer hosts with optional ports", () => {
    for (const peer of ["localhost:3306", "127.0.0.1:5555", "[::1]:3306", "::1:3306"]) {
      assert.equal(isLoopbackPeerHost(peer), true, peer);
    }
    for (const peer of ["10.0.0.5:3306", "db.example:3306", "0.0.0.0:3306", ""]) {
      assert.equal(isLoopbackPeerHost(peer), false, peer);
    }
  });

  it("parses CURRENT_USER without assuming the user lacks '@'", () => {
    assert.deepEqual(parseAccount("app@localhost"), { user: "app", host: "localhost" });
    assert.deepEqual(parseAccount("app@%"), { user: "app", host: "%" });
    assert.deepEqual(parseAccount("a@b@localhost"), { user: "a@b", host: "localhost" });
  });
});

describe("guard: DB_HOST resolution", () => {
  it("accepts loopback literals without a DNS lookup", async () => {
    assert.deepEqual(await assertLoopbackHost("127.0.0.1"), ["127.0.0.1"]);
    assert.deepEqual(await assertLoopbackHost("[::1]"), ["::1"]);
  });

  it("accepts a hostname that resolves only to loopback", async () => {
    const addresses = await assertLoopbackHost("localhost", {
      lookup: fakeLookup(["127.0.0.1", "::1"]),
    });
    assert.deepEqual(addresses, ["127.0.0.1", "::1"]);
  });

  it("rejects a hostname with any non-loopback answer", async () => {
    await assert.rejects(
      assertLoopbackHost("db.example", { lookup: fakeLookup(["127.0.0.1", "10.0.0.5"]) }),
      hasCode("DB_HOST_NOT_LOOPBACK"),
    );
  });

  it("rejects remote literals, empty values and unresolvable names", async () => {
    await assert.rejects(assertLoopbackHost("10.0.0.5"), hasCode("DB_HOST_NOT_LOOPBACK"));
    await assert.rejects(assertLoopbackHost(""), hasCode("DB_HOST_REQUIRED"));
    await assert.rejects(
      assertLoopbackHost("missing.example", {
        lookup: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
      hasCode("DB_HOST_UNRESOLVED"),
    );
  });
});

describe("guard: environment", () => {
  it("accepts the complete test-only environment", () => {
    assert.deepEqual(assertIntegrationEnvironment(baseEnv()), {
      database: "alphadeutsch",
      host: "127.0.0.1",
      port: 3306,
      serverUuid: TEST_SERVER_UUID,
    });
  });

  it("rejects production, missing opt-in and non-mysql stores", () => {
    assert.throws(
      () => assertIntegrationEnvironment(baseEnv({ ALLOW_LOCAL_DB_INTEGRATION_TESTS: "" })),
      hasCode("OPT_IN_REQUIRED"),
    );
    assert.throws(
      () => assertIntegrationEnvironment(baseEnv({ NODE_ENV: "production" })),
      hasCode("NODE_ENV_INVALID"),
    );
    assert.throws(
      () => assertIntegrationEnvironment(baseEnv({ AUTH_STORE: "memory" })),
      hasCode("AUTH_STORE_INVALID"),
    );
  });

  it("rejects SMTP delivery and any other target database", () => {
    assert.throws(
      () => assertIntegrationEnvironment(baseEnv({ AUTH_EMAIL_PROVIDER: "smtp" })),
      hasCode("EMAIL_PROVIDER_INVALID"),
    );
    for (const database of ["alphadeutsch_demo", "alphadeutsch_test", "", "ALPHADEUTSCH"]) {
      assert.throws(
        () => assertIntegrationEnvironment(baseEnv({ DB_NAME: database })),
        hasCode("DB_NAME_INVALID"),
      );
    }
  });

  it("rejects an invalid port or missing user", () => {
    for (const port of ["0", "-1", "65536", "abc", ""]) {
      assert.throws(
        () => assertIntegrationEnvironment(baseEnv({ DB_PORT: port })),
        hasCode("DB_PORT_INVALID"),
      );
    }
    assert.throws(
      () => assertIntegrationEnvironment(baseEnv({ DB_USER: " " })),
      hasCode("DB_USER_REQUIRED"),
    );
  });

  it("rejects missing/invalid peppers without echoing the value", () => {
    const invalidPepper = "f".repeat(63);
    try {
      assertIntegrationEnvironment(baseEnv({ AUTH_CODE_PEPPER: invalidPepper }));
      assert.fail("expected a guard error");
    } catch (error) {
      assert.equal(error.code, "PEPPER_INVALID");
      assert.equal(error.message.includes(invalidPepper), false);
    }
    for (const pepper of ["", "z".repeat(64), "a".repeat(65)]) {
      assert.throws(
        () => assertIntegrationEnvironment(baseEnv({ AUTH_CODE_PEPPER: pepper })),
        hasCode("PEPPER_INVALID"),
      );
    }
  });
});

const DATABASE = "alphadeutsch";
const APPROVED_SCHEMA_TABLES = ["users", "sessions", "verification_challenges"];

/** The minimum the suites need, expressed as table-scoped grants. */
function minimalTableGrants() {
  return [
    "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.`users` TO `it`@`localhost`",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.`verification_challenges` TO `it`@`localhost`",
    "GRANT SELECT, DELETE ON `alphadeutsch`.`sessions` TO `it`@`localhost`",
    "GRANT USAGE ON *.* TO `it`@`localhost`",
  ];
}

function evaluate(grants, overrides = {}) {
  return evaluateGrants(grants, {
    database: DATABASE,
    schemaTables: APPROVED_SCHEMA_TABLES,
    ...overrides,
  });
}

function codes(result) {
  return result.violations.map((violation) => violation.code);
}

describe("guard: privilege scope (M3)", () => {
  it("accepts only the table-scoped DML the suites need", () => {
    const result = evaluate(minimalTableGrants());
    assert.equal(result.ok, true, JSON.stringify(result.violations));
    assert.deepEqual(result.missing, []);
    assert.equal(result.grantScope, "table");
  });

  it("rejects every global grant", () => {
    for (const grant of [
      "GRANT ALL PRIVILEGES ON *.* TO `it`@`localhost`",
      "GRANT SELECT ON *.* TO `it`@`localhost`",
      "GRANT PROCESS ON *.* TO `it`@`localhost`",
      "GRANT ALL PRIVILEGES ON *.* TO `it`@`localhost` WITH GRANT OPTION",
    ]) {
      const result = evaluate([...minimalTableGrants(), grant]);
      assert.equal(result.ok, false, grant);
      assert.ok(codes(result).includes("GLOBAL_PRIVILEGE"), grant);
    }
  });

  it("rejects wildcard database scopes", () => {
    for (const grant of [
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch%`.* TO `it`@`localhost`",
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch\\_%`.* TO `it`@`localhost`",
    ]) {
      const result = evaluate([grant]);
      assert.equal(result.ok, false, grant);
      assert.ok(codes(result).includes("WILDCARD_SCOPE"), grant);
    }
  });

  it("rejects grants on another database", () => {
    const result = evaluate([
      ...minimalTableGrants(),
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `otherdb`.* TO `it`@`localhost`",
    ]);
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("EXCESS_DATABASE"));
  });

  it("rejects DDL, ALL PRIVILEGES and other excess privileges", () => {
    for (const grant of [
      "GRANT CREATE ON `alphadeutsch`.* TO `it`@`localhost`",
      "GRANT DROP ON `alphadeutsch`.`users` TO `it`@`localhost`",
      "GRANT ALTER, INDEX ON `alphadeutsch`.`verification_challenges` TO `it`@`localhost`",
      "GRANT ALL PRIVILEGES ON `alphadeutsch`.`users` TO `it`@`localhost`",
      "GRANT FILE ON `alphadeutsch`.* TO `it`@`localhost`",
      "GRANT EXECUTE ON `alphadeutsch`.* TO `it`@`localhost`",
    ]) {
      const result = evaluate([...minimalTableGrants(), grant]);
      assert.equal(result.ok, false, grant);
      assert.ok(codes(result).includes("EXCESS_PRIVILEGE"), grant);
    }
  });

  it("rejects grants on tables the suites never touch", () => {
    const result = evaluate([
      ...minimalTableGrants(),
      "GRANT DELETE ON `alphadeutsch`.`stud2022` TO `it`@`localhost`",
    ]);
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("EXCESS_TABLE"));
  });

  it("rejects WITH GRANT OPTION", () => {
    const result = evaluate([
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.`users` TO `it`@`localhost` WITH GRANT OPTION",
    ]);
    assert.ok(codes(result).includes("GRANT_OPTION"));
  });

  it("rejects a database-wide grant that reaches other tables", () => {
    const result = evaluate(
      ["GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.* TO `it`@`localhost`"],
      { schemaTables: [...APPROVED_SCHEMA_TABLES, "stud2022"] },
    );
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("SCHEMA_SCOPE_TOO_BROAD"));
  });

  it("accepts a database-wide grant only with a proven minimal inventory", () => {
    const grants = [
      "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.* TO `it`@`localhost`",
    ];
    const accepted = evaluate(grants);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.grantScope, "database");

    const unverified = evaluate(grants, { schemaTables: null });
    assert.equal(unverified.ok, false);
    assert.ok(codes(unverified).includes("SCHEMA_SCOPE_UNVERIFIED"));
  });

  it("reports missing operations per table", () => {
    const withoutSessions = minimalTableGrants().filter((grant) => !grant.includes("`sessions`"));
    assert.deepEqual(
      evaluate(withoutSessions)
        .missing.filter((entry) => entry.startsWith("sessions."))
        .sort(),
      ["sessions.DELETE", "sessions.SELECT"],
    );

    const withoutUsersDelete = minimalTableGrants().map((grant) =>
      grant.includes("`users`") ? grant.replace(", DELETE", "") : grant,
    );
    assert.ok(evaluate(withoutUsersDelete).missing.includes("users.DELETE"));

    assert.equal(evaluate(["GRANT USAGE ON *.* TO `it`@`localhost`"]).ok, false);
  });
});

describe("guard: roles (M4)", () => {
  const direct = [...minimalTableGrants(), "GRANT `reporting`@`%` TO `it`@`localhost`"];
  const broadRole = ["GRANT ALL PRIVILEGES ON *.* TO `reporting`@`%`"];
  const scopedRole = [
    "GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.`users` TO `reporting`@`%`",
  ];

  it("extracts granted roles and never treats a role row as proof", () => {
    assert.deepEqual(parseGrantedRoles(direct), ["`reporting`@`%`"]);
    // The role row itself confers nothing: dropping the sessions grants must
    // still be reported as missing even though the role row is present.
    const withoutSessions = direct.filter((grant) => !grant.includes("`sessions`"));
    assert.ok(evaluate(withoutSessions).missing.includes("sessions.SELECT"));
  });

  it("rejects an account whose role grants broader privileges", () => {
    const result = evaluate(mergeGrants(direct, broadRole));
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("GLOBAL_PRIVILEGE"));
  });

  it("accepts a role whose privileges stay inside the approved scope", () => {
    const result = evaluate(mergeGrants(direct, scopedRole));
    assert.equal(result.ok, true, JSON.stringify(result.violations));
  });

  it("treats an inactive granted role as effective", () => {
    const granted = parseGrantedRoles(direct);
    const active = parseActiveRoles("NONE");
    const inactive = granted.filter((role) => !active.includes(role));
    assert.deepEqual(inactive, ["`reporting`@`%`"]);
    // SET ROLE can enable it at any moment, so its privileges are evaluated and
    // a broad role is refused even while it is inactive.
    assert.equal(evaluate(mergeGrants(direct, broadRole)).ok, false);
  });

  it("parses active roles from CURRENT_ROLE()", () => {
    assert.deepEqual(parseActiveRoles("`a`@`%`,`b`@`localhost`"), [
      "`a`@`%`",
      "`b`@`localhost`",
    ]);
    assert.deepEqual(parseActiveRoles("NONE"), []);
    assert.deepEqual(parseActiveRoles(null), []);
    assert.deepEqual(parseActiveRoles("`unterminated`"), []);
  });

  it("keeps the required set at the tested operations and never DDL", () => {
    for (const privileges of Object.values(REQUIRED_TABLE_PRIVILEGES)) {
      for (const privilege of privileges) {
        assert.ok(ALLOWED_PRIVILEGES.includes(privilege), privilege);
      }
    }
    assert.deepEqual([...REQUIRED_TABLE_PRIVILEGES.sessions], ["SELECT", "DELETE"]);
    assert.equal(ALLOWED_PRIVILEGES.includes("CREATE"), false);
    assert.equal(ALLOWED_PRIVILEGES.includes("DROP"), false);
    assert.equal(ALLOWED_PRIVILEGES.includes("ALTER"), false);
  });

  it("refuses to skip a role row it cannot parse", () => {
    assert.equal(rolesAreFullyParsed(direct), true);
    for (const broken of [
      ["GRANT `reporting` TO `it`@`localhost`"],
      ["GRANT `reporting`@`% TO `it`@`localhost`"],
      ["GRANT ``@`%` TO `it`@`localhost`"],
    ]) {
      assert.equal(rolesAreFullyParsed(broken), false, broken[0]);
    }
    assert.equal(rolesAreFullyParsed(minimalTableGrants()), true);
  });
});

describe("guard: account and peer scope", () => {
  it("accepts a loopback-scoped account", () => {
    assert.deepEqual(assertLocalAccountHost("app@localhost"), {
      user: "app",
      host: "localhost",
      scope: "loopback",
    });
    assert.deepEqual(assertLocalAccountHost("app@127.0.0.1"), {
      user: "app",
      host: "127.0.0.1",
      scope: "loopback",
    });
    assert.equal(isLoopbackAccountHost("localhost"), true);
    assert.equal(isLoopbackAccountHost("127.0.0.1"), true);
  });

  it("rejects wildcard, empty and remote account hosts", () => {
    assert.throws(() => assertLocalAccountHost("app@%"), hasCode("TARGET_ACCOUNT_NOT_LOOPBACK"));
    assert.throws(
      () => assertLocalAccountHost("app@10.0.0.5"),
      hasCode("TARGET_ACCOUNT_NOT_LOOPBACK"),
    );
    assert.throws(() => assertLocalAccountHost("app"), hasCode("TARGET_ACCOUNT_UNVERIFIED"));
    assert.throws(() => assertLocalAccountHost(""), hasCode("TARGET_ACCOUNT_UNVERIFIED"));
    assert.equal(isLoopbackAccountHost("%"), false);
    assert.equal(isLoopbackAccountHost(""), false);
    assert.equal(isLoopbackAccountHost("db.example"), false);
  });

  it("fails closed when the peer cannot be identified", () => {
    assert.throws(() => assertPeerHostVerified(null), hasCode("TARGET_PEER_UNVERIFIED"));
    assert.throws(() => assertPeerHostVerified(undefined), hasCode("TARGET_PEER_UNVERIFIED"));
    assert.throws(() => assertPeerHostVerified(""), hasCode("TARGET_PEER_UNVERIFIED"));
    assert.throws(() => assertPeerHostVerified("   "), hasCode("TARGET_PEER_UNVERIFIED"));
    assert.throws(
      () => assertPeerHostVerified("10.0.0.5:3306"),
      hasCode("TARGET_PEER_NOT_LOOPBACK"),
    );
    assert.equal(assertPeerHostVerified("localhost:3306"), "localhost:3306");
    assert.equal(assertPeerHostVerified("[::1]:3306"), "[::1]:3306");
  });
});

describe("guard: server UUID and SMTP isolation", () => {
  it("requires an exact server UUID", () => {
    for (const value of ["", "   ", "not-a-uuid", "3f2b8c1e9a4411ee8c900242ac120002"]) {
      assert.throws(
        () => assertIntegrationEnvironment(baseEnv({ [SERVER_UUID_ENV]: value })),
        hasCode("SERVER_UUID_REQUIRED"),
      );
    }
    assert.throws(
      () => assertIntegrationEnvironment(baseEnv({ [SERVER_UUID_ENV]: undefined })),
      hasCode("SERVER_UUID_REQUIRED"),
    );
    assert.equal(assertIntegrationEnvironment(baseEnv()).serverUuid, TEST_SERVER_UUID);
  });

  it("rejects SMTP credentials in the integration environment", () => {
    for (const key of [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_SECURE",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM",
    ]) {
      assert.throws(
        () => assertIntegrationEnvironment(baseEnv({ [key]: "value" })),
        hasCode("SMTP_CREDENTIALS_PRESENT"),
        key,
      );
    }
  });
});

describe("guard: environment provenance", () => {
  it("accepts values that came from .env.local", () => {
    const result = assertEnvironmentProvenance(baseEnv(), provenance());
    assert.equal(result.pepperSource, "file");
    assert.deepEqual(result.inheritedKeys, []);
  });

  it("rejects an unknown or file-less provenance", () => {
    assert.throws(
      () => assertEnvironmentProvenance(baseEnv(), null),
      hasCode("ENV_PROVENANCE_UNKNOWN"),
    );
    assert.throws(
      () => assertEnvironmentProvenance(baseEnv(), provenance({ fileLoaded: false })),
      hasCode("ENV_PROVENANCE_UNKNOWN"),
    );
  });

  it("rejects a database value that did not come from the file", () => {
    assert.throws(
      () =>
        assertEnvironmentProvenance(
          baseEnv(),
          provenance({ fromFileKeys: ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"] }),
        ),
      hasCode("ENV_NOT_FROM_FILE"),
    );
  });

  it("rejects SMTP credentials that were not suppressed", () => {
    assert.throws(
      () =>
        assertEnvironmentProvenance(
          baseEnv({ SMTP_HOST: "smtp.example.invalid" }),
          provenance({ suppressedSmtpKeys: [] }),
        ),
      hasCode("SMTP_CREDENTIALS_PRESENT"),
    );
  });
});

describe("statement guard", () => {
  it("allows the scoped writes the tests need", () => {
    for (const sql of [
      "DELETE FROM verification_challenges WHERE user_id = ?",
      "DELETE FROM sessions WHERE user_id = ?",
      "DELETE FROM users WHERE id = ? AND email = ?",
      "UPDATE verification_challenges SET used_at = FROM_UNIXTIME(?) WHERE id = ? AND used_at IS NULL",
      "UPDATE users SET email_verified_at = FROM_UNIXTIME(?) WHERE id = ?",
      "INSERT INTO verification_challenges (user_id) VALUES (?)",
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      "SHOW GRANTS FOR CURRENT_USER()",
      "SET SESSION time_zone = '+00:00'",
    ]) {
      assert.doesNotThrow(() => assertSafeStatement(sql), sql);
    }
  });

  it("refuses the production expired-challenge sweep", () => {
    assert.throws(
      () =>
        assertSafeStatement(
          "DELETE FROM verification_challenges WHERE expires_at <= FROM_UNIXTIME(?) LIMIT 100",
        ),
      (error) => error instanceof ProtectedStatementError && /unscoped DELETE/.test(error.message),
    );
  });

  it("refuses unscoped, unknown-table and DDL statements", () => {
    for (const sql of [
      "DELETE FROM verification_challenges",
      "DELETE FROM users",
      "UPDATE sessions SET user_id = 1",
      "UPDATE students SET name = ?",
      "DELETE FROM students WHERE id = 1",
      "TRUNCATE TABLE verification_challenges",
      "ALTER TABLE users ADD COLUMN extra INT",
      "DROP TABLE users",
      "GRANT ALL ON *.* TO app",
    ]) {
      assert.throws(() => assertSafeStatement(sql), ProtectedStatementError, sql);
    }
    assert.throws(() => assertSafeStatement({}), ProtectedStatementError);
  });
});
