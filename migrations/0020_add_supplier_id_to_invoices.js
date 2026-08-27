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

// Bills (document_type='bill') need a real link to the suppliers table —
// today invoices only has customer_id, so Bills reuse a customer row as
// their "party" even though the counterparty is conceptually a vendor.
// This adds the missing FK; invoiceRepository decides which of
// customer_id/supplier_id gets populated based on document_type.
module.exports = {
  async up(db) {
    if (!(await columnExists(db, "invoices", "supplier_id"))) {
      await db.query(`ALTER TABLE invoices ADD COLUMN supplier_id INT NULL AFTER customer_id`);
    }

    if (!(await indexExists(db, "invoices", "fk_invoices_supplier"))) {
      await db.query(`ALTER TABLE invoices ADD INDEX fk_invoices_supplier (supplier_id)`);
    }

    if (!(await constraintExists(db, "invoices", "fk_invoice_supplier"))) {
      await db.query(`
        ALTER TABLE invoices
        ADD CONSTRAINT fk_invoice_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
      `);
    }
  },
};
