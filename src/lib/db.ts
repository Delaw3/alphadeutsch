import "server-only";

import mysql from "mysql2/promise";

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

function createPool(): mysql.Pool {
  const config = readConfig();
  return mysql.createPool({
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
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}
