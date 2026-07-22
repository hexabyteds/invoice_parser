/**
 * Adds role, plan, and status columns to users table.
 * Promotes ADMIN_EMAIL (from .env) to owner role.
 *
 * Usage: node scripts/migrate-admin.js
 */
require("dotenv").config();

const db = require("../config/database");

async function columnExists(table, column) {
  const [rows] = await db.execute(
    `
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [table, column]
  );

  return rows[0].count > 0;
}

async function addColumn(table, column, definition) {
  const exists = await columnExists(table, column);

  if (exists) {
    console.log(`  ✓ ${table}.${column} already exists`);
    return;
  }

  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  + Added ${table}.${column}`);
}

async function migrate() {
  console.log("Running admin migration...\n");

  await addColumn("users", "role", "VARCHAR(20) NOT NULL DEFAULT 'customer'");
  await addColumn("users", "plan", "VARCHAR(50) NOT NULL DEFAULT 'starter'");
  await addColumn("users", "status", "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addColumn("users", "deleted_at", "DATETIME NULL DEFAULT NULL");

  const adminEmail =
    process.env.ADMIN_EMAIL ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();

  if (adminEmail) {
    const [result] = await db.execute(
      `
      UPDATE users
      SET role = 'owner'
      WHERE email = ?
      `,
      [adminEmail]
    );

    if (result.affectedRows > 0) {
      console.log(`\n  ✓ Promoted ${adminEmail} to owner`);
    } else {
      console.log(`\n  ! No user found for ADMIN_EMAIL=${adminEmail}`);
    }
  } else {
    console.log("\n  ! Set ADMIN_EMAIL in .env to promote an owner account");
  }

  console.log("\nMigration complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
