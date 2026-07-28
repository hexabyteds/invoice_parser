/**
 * Brings production's schema up to date with what the AdminPortal branch's
 * code expects: plans, subscriptions, usage tracking, audit/login history,
 * and the extra admin/role columns on `users`.
 *
 * Written defensively (checks before every CREATE/ALTER) so it's also
 * safe to run again by hand if ever needed — though scripts/migrate.js
 * only runs it once per database (tracked in schema_migrations).
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

module.exports = {
  async up(db) {
    // 1. plans — no dependencies, create first
    if (!(await tableExists(db, "plans"))) {
      await db.query(`
        CREATE TABLE plans (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(50) NOT NULL,
          monthly_price DECIMAL(10,2) DEFAULT '0.00',
          yearly_price DECIMAL(10,2) DEFAULT '0.00',
          invoice_limit INT DEFAULT '0',
          client_limit INT DEFAULT '0',
          user_limit INT DEFAULT '1',
          storage_limit INT DEFAULT '1024',
          ocr_limit INT DEFAULT '0',
          api_access TINYINT(1) DEFAULT '0',
          priority_support TINYINT(1) DEFAULT '0',
          active TINYINT(1) DEFAULT '1',
          featured TINYINT(1) DEFAULT '0',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }

    // 2. users — extra admin/subscription columns + FK to plans
    const userColumns = [
      ["role", "VARCHAR(20) NOT NULL DEFAULT 'customer'"],
      ["subscription_plan", "VARCHAR(50) DEFAULT 'Free'"],
      ["email_verified", "TINYINT(1) DEFAULT '0'"],
      ["last_login", "DATETIME NULL DEFAULT NULL"],
      ["avatar", "VARCHAR(255) DEFAULT NULL"],
      ["is_active", "TINYINT(1) DEFAULT '1'"],
      ["deleted_at", "DATETIME NULL DEFAULT NULL"],
      ["plan_id", "INT DEFAULT NULL"],
    ];
    for (const [col, def] of userColumns) {
      if (!(await columnExists(db, "users", col))) {
        await db.query(`ALTER TABLE users ADD COLUMN \`${col}\` ${def}`);
      }
    }
    if (!(await constraintExists(db, "users", "fk_user_plan"))) {
      await db.query(`
        ALTER TABLE users
        ADD CONSTRAINT fk_user_plan FOREIGN KEY (plan_id) REFERENCES plans (id)
      `);
    }

    // 3. audit_logs
    if (!(await tableExists(db, "audit_logs"))) {
      await db.query(`
        CREATE TABLE audit_logs (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT DEFAULT NULL,
          action VARCHAR(255) DEFAULT NULL,
          description TEXT,
          ip_address VARCHAR(50) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY user_id (user_id),
          CONSTRAINT audit_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }

    // 4. login_history
    if (!(await tableExists(db, "login_history"))) {
      await db.query(`
        CREATE TABLE login_history (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          ip_address VARCHAR(50) DEFAULT NULL,
          browser VARCHAR(255) DEFAULT NULL,
          device VARCHAR(255) DEFAULT NULL,
          login_time DATETIME DEFAULT NULL,
          logout_time DATETIME DEFAULT NULL,
          PRIMARY KEY (id),
          KEY user_id (user_id),
          CONSTRAINT login_history_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }

    // 5. subscriptions — depends on users + plans
    if (!(await tableExists(db, "subscriptions"))) {
      await db.query(`
        CREATE TABLE subscriptions (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          plan_id INT NOT NULL,
          status ENUM('trial','active','expired','cancelled','suspended') DEFAULT NULL,
          billing_cycle ENUM('monthly','yearly') DEFAULT NULL,
          price DECIMAL(10,2) DEFAULT NULL,
          starts_at DATETIME DEFAULT NULL,
          expires_at DATETIME DEFAULT NULL,
          next_billing DATETIME DEFAULT NULL,
          cancelled_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY user_id (user_id),
          KEY plan_id (plan_id),
          CONSTRAINT subscriptions_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id),
          CONSTRAINT subscriptions_ibfk_2 FOREIGN KEY (plan_id) REFERENCES plans (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }

    // 6. usage_stats
    if (!(await tableExists(db, "usage_stats"))) {
      await db.query(`
        CREATE TABLE usage_stats (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          invoices_used INT DEFAULT '0',
          clients_used INT DEFAULT '0',
          ocr_pages_used INT DEFAULT '0',
          storage_used BIGINT DEFAULT '0',
          api_calls_used INT DEFAULT '0',
          team_members_used INT DEFAULT '1',
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY user_id (user_id),
          CONSTRAINT usage_stats_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }
  },
};
