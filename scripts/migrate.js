/**
 * Generic, idempotent migration runner.
 *
 * Applies every file in migrations/ (sorted by filename) that hasn't
 * already been recorded in the `schema_migrations` table. Safe to run
 * repeatedly and safe to run in production — already-applied migrations
 * are skipped.
 *
 * Supports two migration file types:
 *   - 0002_add_something.sql  -> raw SQL, split on ";" and executed in order
 *   - 0003_add_something.js   -> module.exports = { up: async (db) => {...} }
 *
 * Usage:
 *   node scripts/migrate.js
 *   npm run migrate
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../config/database");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getAppliedMigrations() {
  const [rows] = await db.execute(
    "SELECT name FROM schema_migrations ORDER BY name"
  );
  return new Set(rows.map((r) => r.name));
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") || f.endsWith(".js"))
    .sort();
}

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
}

async function runSqlMigration(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = splitSqlStatements(sql);
  for (const statement of statements) {
    await db.query(statement);
  }
}

async function runJsMigration(filePath) {
  const migration = require(filePath);
  if (typeof migration.up !== "function") {
    throw new Error(`Migration ${filePath} must export an "up(db)" function`);
  }
  await migration.up(db);
}

async function markApplied(name) {
  await db.execute("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
}

async function migrate() {
  console.log("Running database migrations...\n");

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = listMigrationFiles();

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("  ✓ Nothing to do — database is up to date.");
    process.exit(0);
  }

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    console.log(`  → Applying ${file} ...`);
    try {
      if (file.endsWith(".sql")) {
        await runSqlMigration(filePath);
      } else {
        await runJsMigration(filePath);
      }
      await markApplied(file);
      console.log(`  ✓ ${file} applied`);
    } catch (err) {
      console.error(`  ✗ ${file} failed: ${err.message}`);
      console.error(
        "\nMigration failed. Fix the migration file and re-run — already applied migrations will be skipped."
      );
      process.exit(1);
    }
  }

  console.log("\nAll migrations applied.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration runner crashed:", err);
  process.exit(1);
});
