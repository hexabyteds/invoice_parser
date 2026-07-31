/**
 * Adds a nullable client_id to audit_logs so activity events (invoice
 * uploaded/rejected/errored, client added) can be attributed to a
 * specific client — needed for the per-client analytics table on the
 * customer dashboard. ON DELETE SET NULL so deleting a client doesn't
 * wipe its historical activity log entries.
 *
 * Written defensively (checks before every ALTER/CREATE INDEX), matching
 * the earlier migrations in this folder.
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

module.exports = {
  async up(db) {
    if (!(await columnExists(db, "audit_logs", "client_id"))) {
      await db.query(
        `ALTER TABLE audit_logs ADD COLUMN client_id INT DEFAULT NULL`
      );
    }

    if (!(await indexExists(db, "audit_logs", "idx_audit_logs_client_id"))) {
      await db.query(
        `CREATE INDEX idx_audit_logs_client_id ON audit_logs (client_id)`
      );
    }

    if (!(await indexExists(db, "audit_logs", "idx_audit_logs_user_created"))) {
      await db.query(
        `CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at)`
      );
    }

    if (
      !(await constraintExists(
        db,
        "audit_logs",
        "fk_audit_logs_client"
      ))
    ) {
      await db.query(
        `ALTER TABLE audit_logs
         ADD CONSTRAINT fk_audit_logs_client
         FOREIGN KEY (client_id) REFERENCES clients (id)
         ON DELETE SET NULL`
      );
    }
  },
};
