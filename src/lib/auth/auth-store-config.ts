export type AuthStoreKind = "memory" | "mysql";

/**
 * Resolves the active AUTH_STORE kind based on environment variables:
 * - Uses "memory" only when NODE_ENV=test.
 * - In every other environment defaults to "mysql".
 * - Throws a clear error if AUTH_STORE=memory is attempted outside NODE_ENV=test.
 */
export function resolveAuthStoreKind(env: NodeJS.ProcessEnv = process.env): AuthStoreKind {
  const isTest = env.NODE_ENV === "test";
  const rawStore = env.AUTH_STORE?.trim().toLowerCase();

  if (rawStore === "memory") {
    if (!isTest) {
      throw new Error("AUTH_STORE=memory is only permitted when NODE_ENV=test");
    }
    return "memory";
  }

  if (isTest && (!rawStore || rawStore === "memory")) {
    return "memory";
  }

  // In every other environment default to mysql
  if (!rawStore || rawStore === "mysql") {
    return "mysql";
  }

  throw new Error(`Unsupported AUTH_STORE configuration: ${env.AUTH_STORE}`);
}

/**
 * Throws a clear error if required MySQL database configuration is missing.
 */
export function validateDbConfig(env: NodeJS.ProcessEnv = process.env): void {
  const host = env.DB_HOST?.trim();
  const portRaw = env.DB_PORT?.trim() ?? "3306";
  const user = env.DB_USER?.trim();
  const database = env.DB_NAME?.trim();
  const port = Number(portRaw);

  const missing: string[] = [];
  if (!host) missing.push("DB_HOST");
  if (!user) missing.push("DB_USER");
  if (!database) missing.push("DB_NAME");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) missing.push("DB_PORT");

  if (missing.length > 0) {
    throw new Error(`Missing or invalid database configuration: ${missing.join(", ")}`);
  }
}

