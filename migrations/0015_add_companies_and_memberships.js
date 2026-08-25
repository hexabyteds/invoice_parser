/**
 * Milestone 1 of the Company/Freelancer tenancy model: introduces the
 * `companies` and `company_memberships` tables and an `account_type` flag
 * on `users`, and backfills every existing user into their own company as
 * OWNER.
 *
 * Purely additive — no existing table (invoices, clients, subscriptions,
 * etc.) is touched here. Those get a `company_id` column in a later
 * migration once this backbone exists to join against. Existing app
 * behavior is unaffected: nothing currently reads these new tables.
 *
 * Every pre-existing user becomes the OWNER of a new company named after
 * their `company_name` (falling back to their own name), because under the
 * current model each user already behaves like a company: they own their
 * own invoices/clients/subscription. This gives every existing account a
 * company to anchor the future `company_id` backfill to, with no data
 * loss and no manual reassignment needed.
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

module.exports = {
  async up(db) {
    if (!(await tableExists(db, "companies"))) {
      await db.query(`
        CREATE TABLE companies (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          legal_name VARCHAR(255) DEFAULT NULL,
          owner_user_id INT NOT NULL,
          status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY fk_company_owner (owner_user_id),
          CONSTRAINT fk_company_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await tableExists(db, "company_memberships"))) {
      await db.query(`
        CREATE TABLE company_memberships (
          id INT NOT NULL AUTO_INCREMENT,
          company_id INT NOT NULL,
          user_id INT NOT NULL,
          role ENUM('OWNER','FREELANCER','STAFF') NOT NULL DEFAULT 'STAFF',
          status ENUM('INVITED','ACTIVE','SUSPENDED','REMOVED') NOT NULL DEFAULT 'INVITED',
          permissions JSON DEFAULT NULL,
          invited_by INT DEFAULT NULL,
          invited_at DATETIME DEFAULT NULL,
          accepted_at DATETIME DEFAULT NULL,
          removed_at DATETIME DEFAULT NULL,
          last_active_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_company_membership (company_id, user_id),
          KEY fk_membership_user (user_id),
          KEY fk_membership_invited_by (invited_by),
          CONSTRAINT fk_membership_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
          CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          CONSTRAINT fk_membership_invited_by FOREIGN KEY (invited_by) REFERENCES users (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await columnExists(db, "users", "account_type"))) {
      await db.query(
        `ALTER TABLE users
         ADD COLUMN account_type ENUM('COMPANY','FREELANCER') DEFAULT NULL
         AFTER role`
      );
    }

    // Backfill: give every existing user a company (idempotent — only users
    // without one yet are picked up) and mark them COMPANY + OWNER.
    await db.query(`
      INSERT INTO companies (name, owner_user_id, status)
      SELECT COALESCE(NULLIF(u.company_name, ''), u.name), u.id, 'ACTIVE'
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM companies c WHERE c.owner_user_id = u.id
      )
    `);

    await db.query(`
      INSERT INTO company_memberships (company_id, user_id, role, status, accepted_at)
      SELECT c.id, c.owner_user_id, 'OWNER', 'ACTIVE', NOW()
      FROM companies c
      WHERE NOT EXISTS (
        SELECT 1 FROM company_memberships m
        WHERE m.company_id = c.id AND m.user_id = c.owner_user_id
      )
    `);

    await db.query(`
      UPDATE users u
      JOIN companies c ON c.owner_user_id = u.id
      SET u.account_type = 'COMPANY'
      WHERE u.account_type IS NULL
    `);
  },
};
