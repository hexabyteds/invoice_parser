async function indexExists(db, table, indexName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].count > 0;
}

async function columnIsNullable(db, table, column) {
  const [rows] = await db.execute(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0]?.IS_NULLABLE === "YES";
}

// A Freelancer's own account-level plan (see companyService/usageService
// changes) is stored as a subscriptions row with company_id = NULL,
// user_id = the Freelancer — reusing the existing Stripe checkout/webhook/
// cancel/renew/payment-history code paths (they already key off
// user_id/stripe_customer_id, not company_id) instead of introducing a
// separate billing table. Company-owned subscriptions are completely
// unaffected — company_id stays required for them at the application
// layer, this migration only widens what the column *allows*.
module.exports = {
  async up(db) {
    if (!(await columnIsNullable(db, "subscriptions", "company_id"))) {
      // Drop the FK first (MySQL won't let you modify a column that's part
      // of one without re-adding it), then restore it unchanged.
      await db.query(`ALTER TABLE subscriptions DROP FOREIGN KEY fk_subscriptions_company`);
      await db.query(`ALTER TABLE subscriptions MODIFY COLUMN company_id INT NULL`);
      await db.query(`
        ALTER TABLE subscriptions
        ADD CONSTRAINT fk_subscriptions_company
        FOREIGN KEY (company_id) REFERENCES companies (id)
      `);
    }

    if (!(await indexExists(db, "subscriptions", "idx_subscriptions_user_company_status"))) {
      await db.query(`
        ALTER TABLE subscriptions
        ADD INDEX idx_subscriptions_user_company_status (user_id, company_id, status)
      `);
    }
  },
};
