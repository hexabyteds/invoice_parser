const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

module.exports = async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, "..", "..", ".env.test") });

  const dbName = process.env.DB_NAME;

  if (!dbName || !dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests: DB_NAME ("${dbName}") does not look like a ` +
        `dedicated test database (expected a "_test" suffix). Check .env.test.`
    );
  }

  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await admin.query(`CREATE DATABASE \`${dbName}\``);
  await admin.query(`USE \`${dbName}\``);

  const schemaSql = fs.readFileSync(
    path.join(__dirname, "..", "..", "db", "schema.sql"),
    "utf8"
  );

  await admin.query(schemaSql);

  // Seed plans used by usage/limit tests. Numbers are test fixtures, not
  // production values — production plans are managed via the admin panel.
  // Starter/Business also carry fake Stripe price IDs so the Stripe
  // checkout/webhook tests can resolve a plan without hitting real Stripe.
  await admin.query(
    `INSERT INTO plans
      (name, slug, monthly_price, yearly_price, invoice_limit, customer_limit, user_limit, storage_limit, ocr_limit, api_access, active, stripe_price_id_monthly, stripe_price_id_yearly)
     VALUES
      ('Free', 'free', 0, 0, 5, 2, 1, 50, 5, 0, 1, NULL, NULL),
      ('Starter', 'starter', 19, 190, 100, 25, 1, 500, 100, 0, 1, 'price_test_starter_monthly', 'price_test_starter_yearly'),
      ('Business', 'business', 99, 990, 1000, 250, 5, 5000, 1000, 1, 1, 'price_test_business_monthly', 'price_test_business_yearly')`
  );

  const [[freePlan]] = await admin.query(
    `SELECT id FROM plans WHERE slug = 'free' LIMIT 1`
  );

  const adminPasswordHash = await bcrypt.hash(
    process.env.QA_ADMIN_PASSWORD,
    10
  );

  const [adminResult] = await admin.query(
    `INSERT INTO users (name, email, password, role, plan, status, plan_id)
     VALUES (?, ?, ?, 'admin', 'FREE', 'ACTIVE', ?)`,
    ["QA Admin", process.env.QA_ADMIN_EMAIL, adminPasswordHash, freePlan.id]
  );

  await admin.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, billing_cycle, price, starts_at)
     VALUES (?, ?, 'active', 'monthly', 0, NOW())`,
    [adminResult.insertId, freePlan.id]
  );

  await admin.query(
    `INSERT INTO usage_stats (user_id) VALUES (?)`,
    [adminResult.insertId]
  );

  await admin.end();
};
