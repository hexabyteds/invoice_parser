/**
 * Adds the Bank Statement document type as two brand-new tables,
 * deliberately NOT touching `invoices` or its document_type ENUM:
 *
 *   bank_statements             — one row per uploaded statement (acts as
 *                                  both the "document" row and the
 *                                  statement-level metadata row for this
 *                                  feature, since the app has no separate
 *                                  generic `documents` table).
 *   bank_statement_transactions — one row per transaction, FK'd to
 *                                  bank_statements, cascade-deleted with it.
 *
 * Keeping these parallel to (not merged into) `invoices` means the
 * existing invoice/bill upload, extraction, edit, list, and export flows
 * are completely unaffected by this migration.
 *
 * Written defensively (checks before every CREATE), matching the earlier
 * migrations in this folder.
 */

async function tableExists(db, table) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].count > 0;
}

module.exports = {
  async up(db) {
    if (!(await tableExists(db, "bank_statements"))) {
      await db.query(`
        CREATE TABLE bank_statements (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          client_id INT DEFAULT NULL,
          original_filename VARCHAR(255) DEFAULT NULL,
          image_path TEXT,
          status ENUM('PENDING','PROCESSED','FAILED') DEFAULT 'PROCESSED',
          page_count INT DEFAULT NULL,
          bank_name VARCHAR(255) DEFAULT NULL,
          account_title VARCHAR(255) DEFAULT NULL,
          account_number VARCHAR(100) DEFAULT NULL,
          iban VARCHAR(50) DEFAULT NULL,
          currency VARCHAR(20) DEFAULT NULL,
          from_date DATE DEFAULT NULL,
          to_date DATE DEFAULT NULL,
          opening_balance DECIMAL(14,2) DEFAULT NULL,
          closing_balance DECIMAL(14,2) DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY fk_bank_statement_user (user_id),
          KEY fk_bank_statement_client (client_id),
          KEY idx_bank_statements_user_created (user_id, created_at),
          CONSTRAINT fk_bank_statement_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          CONSTRAINT fk_bank_statement_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }

    if (!(await tableExists(db, "bank_statement_transactions"))) {
      await db.query(`
        CREATE TABLE bank_statement_transactions (
          id INT NOT NULL AUTO_INCREMENT,
          bank_statement_id INT NOT NULL,
          transaction_date DATE DEFAULT NULL,
          description TEXT,
          credit DECIMAL(14,2) NOT NULL DEFAULT '0.00',
          debit DECIMAL(14,2) NOT NULL DEFAULT '0.00',
          available_balance DECIMAL(14,2) DEFAULT NULL,
          reference_no VARCHAR(100) DEFAULT NULL,
          page_number INT DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY fk_bank_statement_transaction_statement (bank_statement_id),
          KEY idx_bank_statement_transactions_date (bank_statement_id, transaction_date),
          CONSTRAINT fk_bank_statement_transaction_statement FOREIGN KEY (bank_statement_id)
            REFERENCES bank_statements (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }
  },
};
