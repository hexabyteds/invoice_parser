/**
 * Part 2 of the Client -> Customer split (see 0012). Renames the
 * `client_id` FK column to `customer_id` on every table that references
 * the (now renamed) `customers` table: invoices, bank_statements,
 * audit_logs.
 *
 * External HTTP contract (`?client_id=` query params, JSON keys) is
 * deliberately left untouched at the application layer — this is a DB +
 * internal-code-only rename per the plan, handled by other agents.
 *
 * For each table: drop the old FK constraint -> rename the column
 * (same INT/nullable type as today, per db/schema.sql) -> re-add the FK
 * against customers(id) with the exact same ON DELETE behavior it had
 * before (invoices: CASCADE, bank_statements: CASCADE, audit_logs:
 * SET NULL), under a new fk_*_customer constraint name. audit_logs also
 * gets its supporting index renamed (idx_audit_logs_client_id ->
 * idx_audit_logs_customer_id) — invoices/bank_statements don't have a
 * separately-named index (their index shares the FK constraint's name),
 * so no separate index rename is needed there.
 *
 * Written defensively (checks before every ALTER), matching the earlier
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

async function indexExists(db, table, indexName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].count > 0;
}

async function constraintExists(db, table, constraintName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );
  return rows[0].count > 0;
}

async function renameClientIdToCustomerId(db, table, oldFkName, newFkName, onDelete) {
  // Drop the old FK (it currently already points at `customers` thanks to
  // the RENAME TABLE in 0012 auto-updating FK metadata — only the name and
  // the column are stale).
  if (await constraintExists(db, table, oldFkName)) {
    await db.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${oldFkName}`);
  }

  if (
    (await columnExists(db, table, "client_id")) &&
    !(await columnExists(db, table, "customer_id"))
  ) {
    await db.query(
      `ALTER TABLE ${table} CHANGE COLUMN client_id customer_id INT DEFAULT NULL`
    );
  }

  if (!(await constraintExists(db, table, newFkName))) {
    await db.query(
      `ALTER TABLE ${table}
       ADD CONSTRAINT ${newFkName}
       FOREIGN KEY (customer_id) REFERENCES customers (id)
       ON DELETE ${onDelete}`
    );
  }
}

module.exports = {
  async up(db) {
    await renameClientIdToCustomerId(
      db,
      "invoices",
      "fk_invoice_client",
      "fk_invoice_customer",
      "CASCADE"
    );

    await renameClientIdToCustomerId(
      db,
      "bank_statements",
      "fk_bank_statement_client",
      "fk_bank_statement_customer",
      "CASCADE"
    );

    await renameClientIdToCustomerId(
      db,
      "audit_logs",
      "fk_audit_logs_client",
      "fk_audit_logs_customer",
      "SET NULL"
    );

    if (
      (await indexExists(db, "audit_logs", "idx_audit_logs_client_id")) &&
      !(await indexExists(db, "audit_logs", "idx_audit_logs_customer_id"))
    ) {
      await db.query(
        `ALTER TABLE audit_logs RENAME INDEX idx_audit_logs_client_id TO idx_audit_logs_customer_id`
      );
    }
  },
};
