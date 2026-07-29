/**
 * Adds password-reset support to `users`: a hash of the active reset
 * token (never the raw token — same principle as password hashing, so a
 * DB leak doesn't hand out usable reset links) plus its expiry.
 *
 * Written defensively (checks before every ALTER), matching
 * 0001_add_subscriptions_and_admin_schema.js.
 */

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function indexExists(db, table, indexName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].count > 0;
}

module.exports = {
  async up(db) {
    if (!(await columnExists(db, "users", "reset_token_hash"))) {
      await db.query(
        `ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(64) DEFAULT NULL`
      );
    }

    if (!(await columnExists(db, "users", "reset_token_expires"))) {
      await db.query(
        `ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL`
      );
    }

    if (!(await indexExists(db, "users", "idx_users_reset_token_hash"))) {
      await db.query(
        `CREATE INDEX idx_users_reset_token_hash ON users (reset_token_hash)`
      );
    }
  },
};
