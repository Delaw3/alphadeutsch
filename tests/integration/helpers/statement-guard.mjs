// Central write barrier for the opt-in MySQL integration tests — defence in
// depth, never the security boundary.
//
// Every statement that reaches the test-owned pool passes through
// `assertSafeStatement`, so a single accidental wide-reaching write cannot touch
// rows that belong to the developer's real accounts — including the production
// expired-challenge sweep, which is a global
// `DELETE FROM verification_challenges WHERE expires_at <= ... LIMIT 100`.
//
// The boundary is the database account itself: guard.mjs requires an account
// whose *effective* privileges are nothing but SELECT/INSERT/UPDATE/DELETE on
// `users`, `verification_challenges` and `sessions` in `alphadeutsch`, with no
// global scope, no other database, no DDL and no GRANT OPTION. This guard is a
// second line that keeps a mistake (or a future over-privileged account) from
// turning into data loss; it must never be relaxed to compensate for a missing
// permission.

export class ProtectedStatementError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtectedStatementError";
    this.code = "PROTECTED_STATEMENT";
  }
}

/** Tables whose rows must only ever be touched through a scoping predicate. */
export const PROTECTED_TABLES = Object.freeze([
  "users",
  "sessions",
  "verification_challenges",
]);

const DDL_PATTERN = /^\s*(?:alter|create|drop|rename|truncate|grant|revoke|lock|unlock)\b/i;
const DELETE_TABLE = /^delete\s+(?:from\s+)?`?([A-Za-z0-9_]+)`?/i;
const UPDATE_TABLE = /^update\s+`?([A-Za-z0-9_]+)`?/i;
const WRITE_VERB = /^(delete|update)\b/i;

/**
 * A predicate that ties the statement to specific rows: `id = ?`,
 * `user_id IN (…)`, `id <=> ?`. Anything looser (`id IS NOT NULL`,
 * `expires_at <= …`) is not considered scoped.
 */
const SCOPING_PREDICATE = /\b(?:user_id|id)\s*(?:=|<=>|\bin\s*\()/i;

const UNINSPECTABLE =
  "Refusing to execute a statement whose text cannot be inspected.";

function statementText(sql) {
  if (typeof sql === "string") return sql.trim();
  if (sql && typeof sql === "object" && typeof sql.sql === "string") {
    return sql.sql.trim();
  }
  return null;
}

function hasScopingPredicate(text) {
  const where = /\bwhere\b([\s\S]*)$/i.exec(text);
  return where ? SCOPING_PREDICATE.test(where[1]) : false;
}

/**
 * Throws `ProtectedStatementError` for DDL and for any DELETE/UPDATE that is not
 * scoped to concrete rows and a known table.
 */
export function assertSafeStatement(sql) {
  const text = statementText(sql);
  if (text === null) throw new ProtectedStatementError(UNINSPECTABLE);
  if (text === "") return;

  if (DDL_PATTERN.test(text)) {
    throw new ProtectedStatementError(
      "Integration tests must never run DDL or privilege statements.",
    );
  }

  const verbMatch = WRITE_VERB.exec(text);
  if (!verbMatch) return;
  const verb = verbMatch[1].toUpperCase();

  const tablePattern = verb === "DELETE" ? DELETE_TABLE : UPDATE_TABLE;
  const table = (tablePattern.exec(text)?.[1] ?? "").toLowerCase();

  if (!PROTECTED_TABLES.includes(table)) {
    throw new ProtectedStatementError(
      `Refusing an unexpected ${verb} on table "${table || "unknown"}".`,
    );
  }
  if (!hasScopingPredicate(text)) {
    throw new ProtectedStatementError(
      `Refusing an unscoped ${verb} on ${table}: integration tests only touch rows they created.`,
    );
  }
}
