async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

// suppliers_used: no supplier quota has ever existed (confirmed — zero
// references anywhere in the codebase) — mirrors customers_used exactly.
// companies_used: only meaningful on a Freelancer's own account-level
// usage_stats row (company_id IS NULL, see migration 0023) — counts how
// many companies that Freelancer currently owns, atomically incremented
// the same way every other counter here is (UPDATE ... WHERE x < limit).
module.exports = {
  async up(db) {
    if (!(await columnExists(db, "usage_stats", "suppliers_used"))) {
      await db.query(`ALTER TABLE usage_stats ADD COLUMN suppliers_used INT DEFAULT 0 AFTER customers_used`);
    }
    if (!(await columnExists(db, "usage_stats", "companies_used"))) {
      await db.query(`ALTER TABLE usage_stats ADD COLUMN companies_used INT DEFAULT 0 AFTER suppliers_used`);
    }
  },
};
