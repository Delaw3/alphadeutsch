import "server-only";

import mysql from "mysql2/promise";

import { recordDbQuery } from "@/lib/monitoring/perf";

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function readConfig(): DbConfig {
  const host = process.env.DB_HOST?.trim();
  const portRaw = process.env.DB_PORT?.trim() ?? "3306";
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME?.trim();

  const port = Number(portRaw);
  const missing: string[] = [];
  if (!host) missing.push("DB_HOST");
  if (!user) missing.push("DB_USER");
  if (!database) missing.push("DB_NAME");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) missing.push("DB_PORT");

  if (missing.length > 0) {
    throw new Error(`Missing or invalid database configuration: ${missing.join(", ")}`);
  }

  return { host: host as string, port, user: user as string, password, database: database as string };
}

const globalForDb = globalThis as unknown as {
  __alphadeutschPool?: mysql.Pool | undefined;
};

type AnyInvoker = (...args: unknown[]) => unknown;

function isThenable(value: unknown): value is Promise<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === "function";
}

/**
 * Reduces a SQL string to `verb:table` for logging — e.g. "select:course_reg".
 * The statement text beyond the verb/table is discarded, so no parameter values,
 * literals or column data can ever reach a log line.
 */
function describeStatement(sql: string): string {
  const verb =
    /^\s*(select|insert|update|delete|replace|call|show|describe|explain)\b/i.exec(sql)?.[1]?.toLowerCase() ??
    "other";
  const table = /(?:\bfrom|\binto|\bupdate|\bjoin)\s+`?([A-Za-z0-9_]+)`?/i.exec(sql)?.[1]?.toLowerCase();
  return table ? `${verb}:${table}` : verb;
}

/**
 * Wraps `query`/`execute` on the pool so every round-trip is measured.
 * Behaviour is unchanged: the original method is always called with the original
 * arguments and its result (or rejection) is returned untouched.
 */
function instrumentPool(pool: mysql.Pool): mysql.Pool {
  const originalQuery = pool.query.bind(pool) as AnyInvoker;
  const originalExecute = pool.execute.bind(pool) as AnyInvoker;

  function timed(original: AnyInvoker, args: unknown[]): unknown {
    // Callback-style usage: delegate as-is so semantics stay identical.
    if (typeof args[args.length - 1] === "function") return original(...args);

    const sql = typeof args[0] === "string" ? args[0] : "";
    const label = describeStatement(sql);
    const startedAt = performance.now();

    let result: unknown;
    try {
      result = original(...args);
    } catch (error) {
      recordDbQuery({ label, ms: performance.now() - startedAt, failed: true });
      throw error;
    }

    if (!isThenable(result)) {
      recordDbQuery({ label, ms: performance.now() - startedAt });
      return result;
    }

    return result.then(
      (value) => {
        recordDbQuery({ label, ms: performance.now() - startedAt });
        return value;
      },
      (error: unknown) => {
        recordDbQuery({ label, ms: performance.now() - startedAt, failed: true });
        throw error;
      },
    );
  }

  pool.query = ((...args: unknown[]) => timed(originalQuery, args)) as unknown as typeof pool.query;
  pool.execute = ((...args: unknown[]) => timed(originalExecute, args)) as unknown as typeof pool.execute;

  return pool;
}

function createPool(): mysql.Pool {
  const config = readConfig();
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Keep legacy latin1/utf8mb3 data readable without changing the schema.
    charset: "utf8mb4",
  });
  return instrumentPool(pool);
}


/**
 * Server-only pooled MySQL connection.
 * Never import this module (or mysql2) from a client component.
 */
export function getPool(): mysql.Pool {
  if (!globalForDb.__alphadeutschPool) {
    globalForDb.__alphadeutschPool = createPool();
  }
  return globalForDb.__alphadeutschPool;
}

export async function isDatabaseReachable(): Promise<boolean> {
  const pool = getPool();

  const connectStartedAt = performance.now();
  const connection = await pool.getConnection();
  recordDbQuery({ label: "connect", ms: performance.now() - connectStartedAt });

  const pingStartedAt = performance.now();
  try {
    await connection.ping();
    recordDbQuery({ label: "ping", ms: performance.now() - pingStartedAt });
    return true;
  } catch (error) {
    recordDbQuery({ label: "ping", ms: performance.now() - pingStartedAt, failed: true });
    throw error;
  } finally {
    connection.release();
  }
}

