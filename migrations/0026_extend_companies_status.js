async function getColumnType(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0]?.COLUMN_TYPE || "";
}

// Widens companies.status from ACTIVE/INACTIVE to ACTIVE/SUSPENDED/
// DEACTIVATED for the new Super Admin Company Management module (§14 of
// the spec). Verified before writing this: the only place in the codebase
// that branches on this column's value is middleware/companyContext.js,
// which already treats "anything not ACTIVE" as blocked — so adding two
// distinct non-active values instead of one is safe with no other code
// changes required. Existing INACTIVE rows become DEACTIVATED (the more
// permanent of the two new states, matching what INACTIVE meant before
// Suspend/Deactivate were distinct admin actions).
module.exports = {
  async up(db) {
    const columnType = await getColumnType(db, "companies", "status");

    if (columnType.includes("'SUSPENDED'")) return;

    // Widen first (superset including the old value) so existing
    // INACTIVE rows survive the ALTER intact, then backfill, then narrow
    // to the final set — MySQL would otherwise silently blank out any
    // row whose current value isn't in the new enum during a direct
    // narrowing ALTER.
    await db.query(`
      ALTER TABLE companies
      MODIFY COLUMN status ENUM('ACTIVE','INACTIVE','SUSPENDED','DEACTIVATED') NOT NULL DEFAULT 'ACTIVE'
    `);

    await db.query(`
      UPDATE companies SET status = 'DEACTIVATED' WHERE status = 'INACTIVE'
    `);

    await db.query(`
      ALTER TABLE companies
      MODIFY COLUMN status ENUM('ACTIVE','SUSPENDED','DEACTIVATED') NOT NULL DEFAULT 'ACTIVE'
    `);
  },
};
