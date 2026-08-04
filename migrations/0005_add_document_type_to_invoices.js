/**
 * Adds a nullable document_type column to invoices so an upload can be
 * categorized as a Supplier Invoice or a Bill (client-requested feature).
 *
 * Deliberately a NEW column rather than reusing the existing `invoice_type`
 * column — that one is already populated (always "Invoice", written by
 * mapGeminiInvoice in services/invoiceService.js) with a different, OCR-
 * derived concept and isn't safe to repurpose.
 *
 * Nullable with no default so existing rows are unaffected and legacy
 * upload/edit calls that don't pass a type keep working.
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

module.exports = {
  async up(db) {
    if (!(await columnExists(db, "invoices", "document_type"))) {
      await db.query(
        `ALTER TABLE invoices
         ADD COLUMN document_type ENUM('supplier_invoice', 'bill') DEFAULT NULL
         AFTER invoice_type`
      );
    }

    if (
      !(await indexExists(db, "invoices", "idx_invoices_user_document_type"))
    ) {
      await db.query(
        `CREATE INDEX idx_invoices_user_document_type
         ON invoices (user_id, document_type)`
      );
    }
  },
};
