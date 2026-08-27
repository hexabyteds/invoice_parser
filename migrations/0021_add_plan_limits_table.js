async function tableExists(db, table) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].count > 0;
}

// Account-type-aware limit set, one row per (plan, account_type). Separate
// from `plans`' own flat customer_limit/invoice_limit/etc columns (which
// stay untouched and keep governing storage/OCR/team — dimensions this
// feature doesn't need to split by account type) — this table only carries
// the four limits that legitimately differ between a Company and a
// Freelancer on the same plan tier: companies (Freelancer only),
// customers, suppliers, invoices. NULL in any limit column means
// Unlimited — a real sentinel, not an arbitrary large number.
module.exports = {
  async up(db) {
    if (!(await tableExists(db, "plan_limits"))) {
      await db.query(`
        CREATE TABLE plan_limits (
          id INT NOT NULL AUTO_INCREMENT,
          plan_id INT NOT NULL,
          account_type ENUM('COMPANY','FREELANCER') NOT NULL,
          companies_limit INT NULL,
          customers_limit INT NULL,
          suppliers_limit INT NULL,
          invoices_limit INT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_plan_limits_plan_account (plan_id, account_type),
          CONSTRAINT fk_plan_limits_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }
  },
};
