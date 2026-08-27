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

// Powers the new Audit Logs admin module's Module/Status columns and
// filters. `ip_address` already existed but was never written to — no
// schema change needed for it. Existing rows (invoice/bank-statement
// upload events only — the only events ever logged before this) get
// module/status backfilled by inference from their action string so they
// remain filterable rather than showing as blank/"Unknown" forever.
module.exports = {
  async up(db) {
    if (!(await columnExists(db, "audit_logs", "module"))) {
      await db.query(`ALTER TABLE audit_logs ADD COLUMN module VARCHAR(50) DEFAULT NULL AFTER action`);
    }
    if (!(await columnExists(db, "audit_logs", "status"))) {
      await db.query(`ALTER TABLE audit_logs ADD COLUMN status ENUM('SUCCESS','FAILED') DEFAULT 'SUCCESS' AFTER module`);
    }

    if (!(await indexExists(db, "audit_logs", "idx_audit_logs_module"))) {
      await db.query(`ALTER TABLE audit_logs ADD INDEX idx_audit_logs_module (module)`);
    }
    if (!(await indexExists(db, "audit_logs", "idx_audit_logs_company_created"))) {
      await db.query(`ALTER TABLE audit_logs ADD INDEX idx_audit_logs_company_created (company_id, created_at)`);
    }

    await db.query(`
      UPDATE audit_logs SET
        module = 'Bank Statement',
        status = CASE WHEN action = 'bank_statement_error' THEN 'FAILED' ELSE 'SUCCESS' END
      WHERE action LIKE 'bank_statement%' AND module IS NULL
    `);

    await db.query(`
      UPDATE audit_logs SET
        module = 'Invoice',
        status = CASE WHEN action IN ('invoice_error', 'invoice_rejected') THEN 'FAILED' ELSE 'SUCCESS' END
      WHERE (action LIKE 'invoice%') AND module IS NULL
    `);
  },
};
