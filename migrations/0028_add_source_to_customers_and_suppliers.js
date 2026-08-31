async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

// Marks whether a customer/supplier row was created by a human via Add
// Customer/Add Supplier ('manual') or auto-created from an uploaded
// invoice/bill by services/partyResolutionService.js ('auto'). Not
// surfaced in the UI — auto-created records behave identically to manual
// ones everywhere else — kept only for future audit/dedup tooling.
module.exports = {
  async up(db) {
    if (!(await columnExists(db, "customers", "source"))) {
      await db.query(
        `ALTER TABLE customers ADD COLUMN source ENUM('manual','auto') NOT NULL DEFAULT 'manual' AFTER status`
      );
    }
    if (!(await columnExists(db, "suppliers", "source"))) {
      await db.query(
        `ALTER TABLE suppliers ADD COLUMN source ENUM('manual','auto') NOT NULL DEFAULT 'manual' AFTER status`
      );
    }
  },
};
