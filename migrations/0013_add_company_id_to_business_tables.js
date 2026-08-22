/**
 * Milestone 2: company-scopes the business tables that currently only know
 * `user_id`. Adds `company_id` to `invoices`, `clients`, `bank_statements`,
 * `subscriptions`, and `usage_stats`, plus `audit_logs` (nullable, matching
 * its existing nullable `user_id`).
 *
 * `invoice_items` and `bank_statement_transactions` are deliberately left
 * alone — they're scoped through their parent (`invoice_id` /
 * `bank_statement_id`), so adding `company_id` there would just be
 * unenforced duplicate state. `login_history` is left alone too: it's a
 * per-user login/device record, not company-owned business data.
 *
 * Every `user_id` in these tables backfills safely because migration 0012
 * already gave every existing user an OWNER company_membership — so the
 * join below always finds a match, and the NOT NULL + FK can be applied
 * unconditionally right after backfill (verified below, not assumed).
 */

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function fkExists(db, table, constraintName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );
  return rows[0].count > 0;
}

// Adds a nullable `company_id`, backfills it from `company_memberships`
// (OWNER, ACTIVE) via the table's own `user_id`, then — for tables where
// `required` is true — verifies the backfill left no gaps before tightening
// the column to NOT NULL and adding the FK/index.
async function addCompanyId(db, table, { required }) {
  if (!(await columnExists(db, table, "company_id"))) {
    await db.query(
      `ALTER TABLE ${table} ADD COLUMN company_id INT DEFAULT NULL AFTER user_id`
    );
  }

  await db.query(`
    UPDATE ${table} t
    JOIN company_memberships m
      ON m.user_id = t.user_id AND m.role = 'OWNER' AND m.status = 'ACTIVE'
    SET t.company_id = m.company_id
    WHERE t.company_id IS NULL
  `);

  const indexName = `fk_${table}_company`;
  const hasIndex = await fkExists(db, table, indexName);

  if (required) {
    const [[{ gaps }]] = await db.query(
      `SELECT COUNT(*) AS gaps FROM ${table} WHERE company_id IS NULL`
    );
    if (gaps > 0) {
      throw new Error(
        `${table}: ${gaps} row(s) have no OWNER membership to backfill company_id from — ` +
          `investigate before tightening this column to NOT NULL.`
      );
    }

    if (!hasIndex) {
      await db.query(`ALTER TABLE ${table} MODIFY COLUMN company_id INT NOT NULL`);
      await db.query(
        `ALTER TABLE ${table}
         ADD KEY ${indexName} (company_id),
         ADD CONSTRAINT ${indexName} FOREIGN KEY (company_id) REFERENCES companies (id)`
      );
    }
  } else if (!hasIndex) {
    await db.query(
      `ALTER TABLE ${table}
       ADD KEY ${indexName} (company_id),
       ADD CONSTRAINT ${indexName} FOREIGN KEY (company_id) REFERENCES companies (id)`
    );
  }
}

module.exports = {
  async up(db) {
    await addCompanyId(db, "invoices", { required: true });
    await addCompanyId(db, "clients", { required: true });
    await addCompanyId(db, "bank_statements", { required: true });
    await addCompanyId(db, "subscriptions", { required: true });
    await addCompanyId(db, "usage_stats", { required: true });
    await addCompanyId(db, "audit_logs", { required: false });
  },
};
