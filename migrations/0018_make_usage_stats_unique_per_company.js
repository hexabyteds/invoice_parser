/**
 * Finishes what 0017's comment deferred: usage_stats was still "one row
 * per user, unique on user_id" even though every read/write method in
 * usageRepository.js has been company_id-scoped since migration 0016 (the
 * user_id column is only ever populated at creation time, never queried
 * on). That leftover UNIQUE KEY user_id silently blocked a real scenario
 * migration 0017 didn't anticipate: a single Freelancer creating more than
 * one of their own companies (see companyService.createCompany) — the
 * second company's usage_stats row collides on the same owner user_id
 * ("Duplicate entry '<id>' for key 'usage_stats.user_id'").
 *
 * Drops that constraint and makes company_id unique instead — one usage
 * row per company, which is what every method already assumes. Safe to
 * run unconditionally: as of this migration every usage_stats row already
 * has a non-null, non-duplicate company_id (verified — 0016/0017 backfilled
 * every existing row via OWNER membership, and create() has required a
 * companyId argument since 0015).
 */

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
    // usage_stats_ibfk_1 (the FK on user_id -> users.id) needs a supporting
    // index at all times, so a plain non-unique index has to exist before
    // the old UNIQUE KEY user_id can be dropped — MySQL refuses to drop an
    // index still backing a foreign key.
    if (!(await indexExists(db, "usage_stats", "idx_usage_stats_user_id"))) {
      await db.query(
        `ALTER TABLE usage_stats ADD INDEX idx_usage_stats_user_id (user_id)`
      );
    }

    if (await indexExists(db, "usage_stats", "user_id")) {
      await db.query(`ALTER TABLE usage_stats DROP INDEX user_id`);
    }

    if (!(await indexExists(db, "usage_stats", "uq_usage_stats_company_id"))) {
      await db.query(
        `ALTER TABLE usage_stats ADD UNIQUE KEY uq_usage_stats_company_id (company_id)`
      );
    }
  },
};
