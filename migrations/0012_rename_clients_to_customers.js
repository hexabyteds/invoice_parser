/**
 * Splits the generic "Client" entity into Customer + Supplier (Suppliers
 * table follows in 0014). This migration handles the Customer half:
 *
 *   - `clients` -> `customers` via RENAME TABLE. Atomic for InnoDB and
 *     auto-updates the existing FK metadata on invoices/bank_statements/
 *     audit_logs to point at the renamed table (their FK constraints still
 *     reference "clients (id)" by name only, not by physical table — the
 *     column/constraint renames on those tables happen in 0013).
 *   - Adds the ~40 new Zoho Books-parity fields as nullable columns. The
 *     existing company_name/contact_person/email/phone/trn/address/country/
 *     city/notes/status columns are kept as-is (nothing dropped or renamed)
 *     so existing dashboard/analytics/admin reads keep working.
 *   - Renames FK fk_client_user -> fk_customer_user.
 *   - Renames the user-facing usage/plan counters:
 *     usage_stats.clients_used -> customers_used, plans.client_limit ->
 *     customer_limit.
 *
 * Written defensively (checks before every ALTER/RENAME), matching the
 * earlier migrations in this folder.
 */

async function tableExists(db, table) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].count > 0;
}

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
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

// New Zoho-parity columns for `customers`. All nullable — nothing here is
// required, matching the plan's "nothing NOT NULL" instruction.
const NEW_CUSTOMER_COLUMNS = [
  ["salutation", "VARCHAR(20) DEFAULT NULL"],
  ["primary_contact_first_name", "VARCHAR(150) DEFAULT NULL"],
  ["primary_contact_last_name", "VARCHAR(150) DEFAULT NULL"],
  ["display_name", "VARCHAR(255) DEFAULT NULL"],
  ["customer_type", "VARCHAR(50) DEFAULT NULL"],
  ["mobile", "VARCHAR(30) DEFAULT NULL"],
  ["website", "VARCHAR(255) DEFAULT NULL"],
  ["department", "VARCHAR(150) DEFAULT NULL"],
  ["designation", "VARCHAR(150) DEFAULT NULL"],
  ["tax_treatment", "VARCHAR(50) DEFAULT NULL"],
  ["place_of_supply", "VARCHAR(100) DEFAULT NULL"],
  ["currency", "VARCHAR(20) DEFAULT NULL"],
  ["payment_terms", "VARCHAR(50) DEFAULT NULL"],
  ["opening_balance", "DECIMAL(14,2) DEFAULT NULL"],
  ["opening_balance_date", "DATE DEFAULT NULL"],
  ["billing_attention", "VARCHAR(150) DEFAULT NULL"],
  ["billing_country", "VARCHAR(100) DEFAULT NULL"],
  ["billing_address_line1", "VARCHAR(255) DEFAULT NULL"],
  ["billing_address_line2", "VARCHAR(255) DEFAULT NULL"],
  ["billing_city", "VARCHAR(100) DEFAULT NULL"],
  ["billing_state", "VARCHAR(100) DEFAULT NULL"],
  ["billing_postal_code", "VARCHAR(20) DEFAULT NULL"],
  ["billing_phone", "VARCHAR(30) DEFAULT NULL"],
  ["shipping_attention", "VARCHAR(150) DEFAULT NULL"],
  ["shipping_country", "VARCHAR(100) DEFAULT NULL"],
  ["shipping_address_line1", "VARCHAR(255) DEFAULT NULL"],
  ["shipping_address_line2", "VARCHAR(255) DEFAULT NULL"],
  ["shipping_city", "VARCHAR(100) DEFAULT NULL"],
  ["shipping_state", "VARCHAR(100) DEFAULT NULL"],
  ["shipping_postal_code", "VARCHAR(20) DEFAULT NULL"],
  ["shipping_phone", "VARCHAR(30) DEFAULT NULL"],
  ["customer_category", "VARCHAR(100) DEFAULT NULL"],
  ["customer_segment", "VARCHAR(100) DEFAULT NULL"],
  ["risk", "VARCHAR(50) DEFAULT NULL"],
  ["approval_status", "VARCHAR(50) DEFAULT NULL"],
  ["portal_access", "TINYINT(1) DEFAULT NULL"],
  ["portal_language", "VARCHAR(50) DEFAULT NULL"],
  ["salesperson", "VARCHAR(150) DEFAULT NULL"],
  ["account_manager", "VARCHAR(150) DEFAULT NULL"],
  ["cost_centre", "VARCHAR(100) DEFAULT NULL"],
];

module.exports = {
  async up(db) {
    // 1. clients -> customers
    if ((await tableExists(db, "clients")) && !(await tableExists(db, "customers"))) {
      await db.query(`RENAME TABLE clients TO customers`);
    }

    // 2. New Zoho-parity columns (nullable, additive only)
    for (const [column, definition] of NEW_CUSTOMER_COLUMNS) {
      if (!(await columnExists(db, "customers", column))) {
        await db.query(
          `ALTER TABLE customers ADD COLUMN ${column} ${definition}`
        );
      }
    }

    // 3. fk_client_user -> fk_customer_user
    if (await constraintExists(db, "customers", "fk_client_user")) {
      await db.query(`ALTER TABLE customers DROP FOREIGN KEY fk_client_user`);
    }
    if (!(await constraintExists(db, "customers", "fk_customer_user"))) {
      await db.query(
        `ALTER TABLE customers
         ADD CONSTRAINT fk_customer_user
         FOREIGN KEY (user_id) REFERENCES users (id)
         ON DELETE CASCADE`
      );
    }

    // 4. Usage/plan counter renames (user-facing: Usage page, admin dashboard)
    if (
      (await columnExists(db, "usage_stats", "clients_used")) &&
      !(await columnExists(db, "usage_stats", "customers_used"))
    ) {
      await db.query(
        `ALTER TABLE usage_stats CHANGE COLUMN clients_used customers_used INT DEFAULT 0`
      );
    }

    if (
      (await columnExists(db, "plans", "client_limit")) &&
      !(await columnExists(db, "plans", "customer_limit"))
    ) {
      await db.query(
        `ALTER TABLE plans CHANGE COLUMN client_limit customer_limit INT DEFAULT 0`
      );
    }
  },
};
