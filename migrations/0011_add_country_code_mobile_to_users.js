/**
 * Adds `country_code` and `mobile_number` to `users`, completing the
 * contact-info trio alongside the existing `country` column so new
 * signups can require Country + Country Code + Mobile Number.
 *
 * Both columns are nullable with no default and never backfilled —
 * existing accounts registered before this change simply have NULL here.
 * That's intentional: the new fields are only mandatory going forward for
 * new signups (enforced in authService.register), not retroactively for
 * existing users, so login/session/auth behavior for pre-existing rows is
 * unaffected.
 *
 * The unique key on (country_code, mobile_number) enforces one account
 * per phone number for new signups (mirroring the existing unique `email`
 * key) without blocking existing rows: MySQL treats each NULL as distinct
 * in a composite unique index, so multiple pre-existing rows with both
 * columns NULL coexist fine.
 *
 * Written defensively (checks before every ALTER), matching earlier
 * migrations in this folder.
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
    if (!(await columnExists(db, "users", "country_code"))) {
      await db.query(
        `ALTER TABLE users
         ADD COLUMN country_code VARCHAR(10) DEFAULT NULL
         AFTER country`
      );
    }

    if (!(await columnExists(db, "users", "mobile_number"))) {
      await db.query(
        `ALTER TABLE users
         ADD COLUMN mobile_number VARCHAR(20) DEFAULT NULL
         AFTER country_code`
      );
    }

    if (!(await indexExists(db, "users", "uq_users_country_code_mobile"))) {
      await db.query(
        `ALTER TABLE users
         ADD UNIQUE KEY uq_users_country_code_mobile (country_code, mobile_number)`
      );
    }
  },
};
