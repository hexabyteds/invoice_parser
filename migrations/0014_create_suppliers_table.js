/**
 * Adds a brand-new `suppliers` table — the second half of the Client ->
 * Customer/Supplier split (see 0012/0013). This is a standalone vendor
 * address book for this phase: own id space, user_id-scoped, own FK to
 * users. Deliberately NOT referenced by invoices/bank_statements/
 * audit_logs — suppliers aren't wired into upload/invoice attribution yet,
 * so no incoming FKs from those tables.
 *
 * Column set mirrors the Customer Zoho-parity fields with vendor-flavored
 * equivalents (vendor_type/vendor_category/vendor_classification/
 * procurement_category/default_expense_account in place of Customer's
 * customer_type/customer_category/customer_segment/risk/approval_status/
 * portal fields/salesperson/account_manager/cost_centre).
 *
 * `status` isn't a Zoho field but is added for UI-pattern parity with the
 * Customers list's active/inactive toggle. Vendor/Customer codes ("Auto"
 * in the source xlsx) are not stored — computed at the service layer from
 * `id` when shaping API responses.
 *
 * Written defensively (checks before CREATE), matching the earlier
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
    if (!(await tableExists(db, "suppliers"))) {
      await db.query(`
        CREATE TABLE suppliers (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          vendor_type VARCHAR(50) DEFAULT NULL,
          salutation VARCHAR(20) DEFAULT NULL,
          primary_contact_first_name VARCHAR(150) DEFAULT NULL,
          primary_contact_last_name VARCHAR(150) DEFAULT NULL,
          company_name VARCHAR(255) NOT NULL,
          display_name VARCHAR(255) DEFAULT NULL,
          email VARCHAR(255) DEFAULT NULL,
          phone VARCHAR(30) DEFAULT NULL,
          mobile VARCHAR(30) DEFAULT NULL,
          website VARCHAR(255) DEFAULT NULL,
          department VARCHAR(150) DEFAULT NULL,
          designation VARCHAR(150) DEFAULT NULL,
          tax_treatment VARCHAR(50) DEFAULT NULL,
          trn VARCHAR(100) DEFAULT NULL,
          place_of_supply VARCHAR(100) DEFAULT NULL,
          currency VARCHAR(20) DEFAULT NULL,
          payment_terms VARCHAR(50) DEFAULT NULL,
          opening_balance DECIMAL(14,2) DEFAULT NULL,
          opening_balance_date DATE DEFAULT NULL,
          billing_attention VARCHAR(150) DEFAULT NULL,
          billing_country VARCHAR(100) DEFAULT NULL,
          billing_address_line1 VARCHAR(255) DEFAULT NULL,
          billing_address_line2 VARCHAR(255) DEFAULT NULL,
          billing_city VARCHAR(100) DEFAULT NULL,
          billing_state VARCHAR(100) DEFAULT NULL,
          billing_postal_code VARCHAR(20) DEFAULT NULL,
          billing_phone VARCHAR(30) DEFAULT NULL,
          shipping_attention VARCHAR(150) DEFAULT NULL,
          shipping_country VARCHAR(100) DEFAULT NULL,
          shipping_address_line1 VARCHAR(255) DEFAULT NULL,
          shipping_address_line2 VARCHAR(255) DEFAULT NULL,
          shipping_city VARCHAR(100) DEFAULT NULL,
          shipping_state VARCHAR(100) DEFAULT NULL,
          shipping_postal_code VARCHAR(20) DEFAULT NULL,
          shipping_phone VARCHAR(30) DEFAULT NULL,
          vendor_category VARCHAR(100) DEFAULT NULL,
          vendor_classification VARCHAR(100) DEFAULT NULL,
          procurement_category VARCHAR(100) DEFAULT NULL,
          default_expense_account VARCHAR(150) DEFAULT NULL,
          notes TEXT,
          status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY fk_supplier_user (user_id),
          CONSTRAINT fk_supplier_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }
  },
};
