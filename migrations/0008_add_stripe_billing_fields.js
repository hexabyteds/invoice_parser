/**
 * Wires Stripe into the existing plans/users/subscriptions tables instead of
 * introducing a parallel billing schema:
 *
 *   plans         — gets the Stripe Price/Product IDs the backend resolves
 *                    checkout sessions from (never trusting a price from the
 *                    client).
 *   users         — gets a single stripe_customer_id so we never create
 *                    duplicate Stripe customers for the same user.
 *   subscriptions — gets the fields needed to reconcile Stripe webhook
 *                    events back onto a row (stripe_subscription_id is the
 *                    join key), plus stripe_status (the raw Stripe status,
 *                    kept alongside the existing local `status` enum which
 *                    only ever meant "active" in app code before Stripe) and
 *                    cancel_at_period_end for the cancel-at-period-end flow.
 *
 * New table stripe_webhook_events is purely a webhook idempotency log —
 * Stripe can and will deliver the same event more than once.
 *
 * Written defensively (checks before every CREATE/ALTER), matching the
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

module.exports = {
  async up(db) {
    // 1. plans — Stripe Price/Product IDs
    const planColumns = [
      ["stripe_product_id", "VARCHAR(255) DEFAULT NULL"],
      ["stripe_price_id_monthly", "VARCHAR(255) DEFAULT NULL"],
      ["stripe_price_id_yearly", "VARCHAR(255) DEFAULT NULL"],
    ];
    for (const [col, def] of planColumns) {
      if (!(await columnExists(db, "plans", col))) {
        await db.query(`ALTER TABLE plans ADD COLUMN \`${col}\` ${def}`);
      }
    }

    // 2. users — one Stripe Customer per user
    if (!(await columnExists(db, "users", "stripe_customer_id"))) {
      await db.query(
        `ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL`
      );
    }
    if (!(await constraintExists(db, "users", "uq_users_stripe_customer_id"))) {
      await db.query(`
        ALTER TABLE users
        ADD CONSTRAINT uq_users_stripe_customer_id UNIQUE (stripe_customer_id)
      `);
    }

    // 3. subscriptions — Stripe reconciliation fields
    const subscriptionColumns = [
      ["stripe_subscription_id", "VARCHAR(255) DEFAULT NULL"],
      ["stripe_customer_id", "VARCHAR(255) DEFAULT NULL"],
      ["stripe_price_id", "VARCHAR(255) DEFAULT NULL"],
      ["stripe_status", "VARCHAR(50) DEFAULT NULL"],
      ["cancel_at_period_end", "TINYINT(1) NOT NULL DEFAULT 0"],
    ];
    for (const [col, def] of subscriptionColumns) {
      if (!(await columnExists(db, "subscriptions", col))) {
        await db.query(`ALTER TABLE subscriptions ADD COLUMN \`${col}\` ${def}`);
      }
    }
    if (
      !(await constraintExists(
        db,
        "subscriptions",
        "uq_subscriptions_stripe_subscription_id"
      ))
    ) {
      await db.query(`
        ALTER TABLE subscriptions
        ADD CONSTRAINT uq_subscriptions_stripe_subscription_id
        UNIQUE (stripe_subscription_id)
      `);
    }

    // 4. stripe_webhook_events — idempotency log
    if (!(await tableExists(db, "stripe_webhook_events"))) {
      await db.query(`
        CREATE TABLE stripe_webhook_events (
          id INT NOT NULL AUTO_INCREMENT,
          stripe_event_id VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_stripe_webhook_events_event_id (stripe_event_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
    }
  },
};
