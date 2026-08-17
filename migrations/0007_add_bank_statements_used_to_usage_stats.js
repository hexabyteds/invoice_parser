/**
 * Adds a separate bank_statements_used counter to usage_stats.
 *
 * Bank statement uploads still consume ocr_pages_used/ocr_limit (they cost
 * real Gemini pages, same abuse guard as invoices/bills) but must NOT
 * increment invoices_used or count against invoice_limit — otherwise the
 * "Total Invoices" stat and invoice plan limit would be silently inflated
 * by an unrelated document type. This counter is tracked independently
 * with no plan-limit gate for now (simple increment on successful
 * creation, no atomic reservation needed since nothing caps it yet).
 *
 * Written defensively (checks before ALTER), matching the earlier
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

module.exports = {
  async up(db) {
    if (!(await columnExists(db, "usage_stats", "bank_statements_used"))) {
      await db.query(
        `ALTER TABLE usage_stats
         ADD COLUMN bank_statements_used INT DEFAULT '0' AFTER invoices_used`
      );
    }
  },
};
