// Test-owned MySQL pool for the opt-in integration tests.
//
// - Never uses src/lib/db.ts or the application's global pool.
// - UTC on both sides: mysql2 parses DATETIME as UTC (`timezone: "Z"`) and every
//   acquired connection runs `SET SESSION time_zone = '+00:00'` before use.
// - `dateStrings` stays false so the store's mapRow receives Date objects.
// - A low lock-wait timeout keeps a broken concurrency assumption from hanging
//   the suite for the server default (50 s).
// - Every statement passes the shared write barrier
//   (helpers/statement-guard.mjs) before MySQL sees it, so the production
//   expired-challenge sweep cannot remove rows from real accounts.
// - Acquisition is bounded: a test that holds more connections than the pool
//   allows fails fast instead of hanging until the runner timeout.

import mysql from "mysql2/promise";

import { assertSafeStatement } from "./statement-guard.mjs";

export const LOCK_WAIT_TIMEOUT_SECONDS = 5;
export const CONNECTION_LIMIT = 5;
export const QUEUE_LIMIT = CONNECTION_LIMIT;
export const ACQUIRE_TIMEOUT_MS = 5_000;

function hasParams(params) {
  return params !== undefined && params !== null;
}

/** Raised instead of waiting forever for a pool slot. */
export class PoolAcquisitionTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "PoolAcquisitionTimeoutError";
    this.code = "POOL_ACQUIRE_TIMEOUT";
  }
}

/** One pooled connection, with the write barrier in front of every statement. */
class GuardedConnection {
  constructor(connection) {
    this.connection = connection;
  }

  async query(sql, params) {
    assertSafeStatement(sql);
    return hasParams(params) ? this.connection.query(sql, params) : this.connection.query(sql);
  }

  async execute(sql, params) {
    assertSafeStatement(sql);
    return hasParams(params) ? this.connection.execute(sql, params) : this.connection.execute(sql);
  }

  beginTransaction() {
    return this.connection.beginTransaction();
  }

  commit() {
    return this.connection.commit();
  }

  rollback() {
    return this.connection.rollback();
  }

  release() {
    return this.connection.release();
  }
}

export function createIntegrationPool(config, { acquireTimeoutMs = ACQUIRE_TIMEOUT_MS } = {}) {
  const base = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: false,
    waitForConnections: true,
    connectionLimit: CONNECTION_LIMIT,
    // A finite queue turns "too many concurrent transactions" into an immediate
    // error instead of an indefinite wait.
    queueLimit: QUEUE_LIMIT,
    connectTimeout: 5000,
  });

  // Session settings persist per physical connection; apply them once.
  const prepared = new WeakSet();

  async function prepare(connection) {
    if (prepared.has(connection)) return connection;
    await connection.query("SET SESSION time_zone = '+00:00'");
    await connection.query(
      `SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SECONDS}`,
    );
    prepared.add(connection);
    return connection;
  }

  /** Bounded acquisition; a late connection is released instead of leaked. */
  async function acquire() {
    const pending = base.getConnection();
    let timer = null;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new PoolAcquisitionTimeoutError(
              `Timed out after ${acquireTimeoutMs} ms waiting for a pool connection.`,
            ),
          ),
        acquireTimeoutMs,
      );
      if (typeof timer.unref === "function") timer.unref();
    });

    try {
      return await Promise.race([pending, timeout]);
    } catch (error) {
      // Never leak a connection that arrives after the timeout fired.
      pending.then((connection) => connection.release()).catch(() => undefined);
      throw error;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  return {
    async query(sql, params) {
      assertSafeStatement(sql);
      const connection = await acquire();
      try {
        await prepare(connection);
        return hasParams(params)
          ? await connection.query(sql, params)
          : await connection.query(sql);
      } finally {
        connection.release();
      }
    },

    async getConnection() {
      const connection = await acquire();
      try {
        await prepare(connection);
        return new GuardedConnection(connection);
      } catch (error) {
        connection.release();
        throw error;
      }
    },

    async end() {
      await base.end();
    },
  };
}

export async function closePoolQuietly(pool) {
  if (!pool || typeof pool.end !== "function") return;
  try {
    await pool.end();
  } catch {
    // Closing must never mask the test result.
  }
}

export async function queryRows(pool, sql, params) {
  const [rows] = hasParams(params)
    ? await pool.query(sql, params)
    : await pool.query(sql);
  return rows;
}

export async function queryOne(pool, sql, params) {
  const rows = await queryRows(pool, sql, params);
  return rows[0] ?? null;
}
