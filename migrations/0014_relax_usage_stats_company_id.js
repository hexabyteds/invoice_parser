/**
 * Corrects a mistake from migration 0013: usage_stats.company_id was made
 * NOT NULL under the assumption every usage_stats row's owner has a
 * company. That's false for a Freelancer account (introduced in migration
 * 0012/authService's Milestone 5 signup flow) — a freelancer owns no
 * company, so a usage_stats row created for them (today: only via the
 * legacy per-user lazy-creation path in usageService.ensureUsageRecord)
 * has no company to attach to.
 *
 * Relaxes the column back to nullable. This does NOT implement real
 * per-company usage tracking (usage_stats is still one row per user,
 * unique on user_id) — that's a deliberately separate future migration
 * once quota is actually resolved from the active company context at
 * usage time, not from the row owner's own company at creation time. For
 * now, company_id is populated opportunistically (via OWNER membership)
 * where one exists, and left NULL otherwise — exactly the "not wired to
 * company quota yet" state already flagged after Milestone 2.
 */

async function columnIsNullable(db, table, column) {
  const [rows] = await db.execute(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0]?.IS_NULLABLE === "YES";
}

module.exports = {
  async up(db) {
    if (!(await columnIsNullable(db, "usage_stats", "company_id"))) {
      await db.query(
        `ALTER TABLE usage_stats MODIFY COLUMN company_id INT DEFAULT NULL`
      );
    }
  },
};
