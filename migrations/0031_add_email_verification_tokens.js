/**
 * Adds a real verify-email flow. `users.email_verified` has existed in the
 * schema since the original dump but nothing has ever set or checked it —
 * every signup today is immediately fully active. This adds the token pair
 * needed to actually verify an address, mirroring the existing password
 * reset columns (`reset_token_hash` / `reset_token_expires`) exactly: the
 * raw token is emailed and never stored, only its SHA-256 hash is.
 *
 * Verification is intentionally NOT wired into login/access control by
 * this migration alone — see services/authService.js. It's additive and
 * safe to run against a database with existing users (all nullable, no
 * default changes to `email_verified` itself).
 */

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

module.exports = {
  async up(db) {
    if (!(await columnExists(db, "users", "email_verify_token_hash"))) {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN email_verify_token_hash VARCHAR(64) DEFAULT NULL,
        ADD COLUMN email_verify_token_expires DATETIME DEFAULT NULL
      `);
    }

    const [indexRows] = await db.execute(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_email_verify_token_hash'`
    );

    if (!indexRows.length) {
      await db.query(`
        CREATE INDEX idx_users_email_verify_token_hash ON users (email_verify_token_hash)
      `);
    }
  },
};
