import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

// SECURITY: Read DB credentials strictly from .env.local only
// Never log, print, or pass credentials in command line arguments
const envLocalPath = resolve(".env.local");
if (!existsSync(envLocalPath)) {
  console.error("Configuration error: .env.local not found. Credentials must be in .env.local only.");
  process.exit(1);
}

process.loadEnvFile(envLocalPath);

const host = process.env.DB_HOST?.trim();
const port = Number(process.env.DB_PORT?.trim() ?? "3306");
const user = process.env.DB_USER?.trim();
const password = process.env.DB_PASSWORD ?? "";
const database = process.env.DB_NAME?.trim();

if (!host || !user || !database) {
  console.error("Configuration error: DB_HOST, DB_USER, and DB_NAME must be specified in .env.local.");
  process.exit(1);
}

// Guard: Refuse to run unless DB_HOST is localhost or 127.0.0.1 (unless --allow-remote is passed)
const allowRemote = process.argv.includes("--allow-remote");
const isLocal = host === "localhost" || host === "127.0.0.1";
if (!isLocal && !allowRemote) {
  console.error(
    `Security guard: Refusing to run migrations against non-local host '${host}'. Pass --allow-remote to override.`,
  );
  process.exit(1);
}

async function run() {
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    console.log("Connected to MySQL database.");

    // 1. Ensure schema_migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
        \`version\` VARCHAR(100) NOT NULL PRIMARY KEY,
        \`applied_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Discover migration files in order
    const migrationsDir = resolve("migrations");
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log(`Found ${files.length} migration file(s) in order: ${files.join(", ")}`);

    // 3. Apply pending migrations in order
    for (const file of files) {
      const [appliedRows] = await connection.query(
        "SELECT `version` FROM `schema_migrations` WHERE `version` = ? LIMIT 1",
        [file],
      );

      if (Array.isArray(appliedRows) && appliedRows.length > 0) {
        console.log(`Migration [${file}] already applied. Skipping.`);
        continue;
      }

      console.log(`Applying migration [${file}]...`);
      const filePath = resolve(migrationsDir, file);
      const sql = readFileSync(filePath, "utf8");

      // Execute migration SQL
      await connection.query(sql);

      // Record migration in schema_migrations
      await connection.query(
        "INSERT INTO `schema_migrations` (`version`) VALUES (?)",
        [file],
      );
      console.log(`Migration [${file}] successfully applied and recorded.`);
    }

    // 4. Report SHOW TABLES
    console.log("\n==================== SHOW TABLES ====================");
    const [tables] = await connection.query("SHOW TABLES");
    console.table(tables);

    // 5. Report DESCRIBE users
    console.log("\n==================== DESCRIBE users ====================");
    const [userDesc] = await connection.query("DESCRIBE `users`");
    console.table(userDesc);

    // 6. Report the five table row counts (472, 734, 616, 24, 6)
    console.log("\n==================== FIVE ROW COUNTS ====================");
    const [stud] = await connection.query("SELECT COUNT(*) AS count FROM `stud2022`");
    const [courseReg] = await connection.query("SELECT COUNT(*) AS count FROM `course_reg`");
    const [results] = await connection.query("SELECT COUNT(*) AS count FROM `results`");
    const [courses] = await connection.query("SELECT COUNT(*) AS count FROM `courses`");
    const [packages] = await connection.query("SELECT COUNT(*) AS count FROM `packages`");

    const counts = [
      { Table: "stud2022", Expected: 472, Actual: stud[0].count },
      { Table: "course_reg", Expected: 734, Actual: courseReg[0].count },
      { Table: "results", Expected: 616, Actual: results[0].count },
      { Table: "courses", Expected: 24, Actual: courses[0].count },
      { Table: "packages", Expected: 6, Actual: packages[0].count },
    ];
    console.table(counts);

    console.log("\nAll operations completed successfully.");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Migration runner failed:", error.message);
  process.exit(1);
});
