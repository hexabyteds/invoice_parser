const db = require("../config/database");
const { toDbStatus } = require("../utils/userStatus");

const CUSTOMER_FILTER = `
  u.role = 'customer'
  AND u.deleted_at IS NULL
`;

class AdminRepository {
  async getPlatformStats() {
    const [[customerStats]] = await db.execute(`
      SELECT
        COUNT(*) AS total_customers,
        SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END) AS active_subscriptions
      FROM users
      WHERE role = 'customer'
        AND deleted_at IS NULL
    `);

    const [[invoiceStats]] = await db.execute(`
      SELECT
        COUNT(*) AS total_invoices,
        COALESCE(SUM(total_amount), 0) AS invoice_volume
      FROM invoices
    `);

    const [activeUsers] = await db.execute(`
      SELECT plan, status
      FROM users
      WHERE role = 'customer'
        AND deleted_at IS NULL
    `);

    return {
      totalCustomers: Number(customerStats.total_customers || 0),
      activeSubscriptions: Number(customerStats.active_subscriptions || 0),
      totalInvoices: Number(invoiceStats.total_invoices || 0),
      invoiceVolume: Number(invoiceStats.invoice_volume || 0),
      activeUsers,
    };
  }

  async getRecentCustomers(limit = 5) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 50));

    const [rows] = await db.execute(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company_name,
        u.plan,
        u.status,
        u.created_at,
        (SELECT COUNT(*) FROM clients c WHERE c.user_id = u.id) AS client_count,
        (SELECT COUNT(*) FROM invoices i WHERE i.user_id = u.id) AS invoice_count
      FROM users u
      WHERE ${CUSTOMER_FILTER}
      ORDER BY u.created_at DESC
      LIMIT ${safeLimit}
      `
    );

    return rows;
  }

  async getPlanDistribution() {
    const [rows] = await db.execute(`
      SELECT
        plan,
        COUNT(*) AS count
      FROM users
      WHERE role = 'customer'
        AND deleted_at IS NULL
      GROUP BY plan
      ORDER BY count DESC
    `);

    return rows;
  }

  // Aggregates are computed once per user (grouped subqueries joined in),
  // not re-run per output row like the old correlated subqueries were —
  // see PERF-07. Paginated so listing thousands of customers doesn't
  // return (or scan) the whole table at once.
  async getAllCustomers({ limit = 20, offset = 0 } = {}) {
    const [rows] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company_name,
        u.plan,
        u.status,
        u.created_at,
        COALESCE(client_counts.client_count, 0) AS client_count,
        COALESCE(invoice_stats.invoice_count, 0) AS invoice_count,
        COALESCE(invoice_stats.invoice_total, 0) AS invoice_total
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS client_count
        FROM clients
        GROUP BY user_id
      ) client_counts ON client_counts.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS invoice_count, COALESCE(SUM(total_amount), 0) AS invoice_total
        FROM invoices
        GROUP BY user_id
      ) invoice_stats ON invoice_stats.user_id = u.id
      WHERE ${CUSTOMER_FILTER}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );

    return rows;
  }

  async countAllCustomers() {
    const [[row]] = await db.execute(
      `SELECT COUNT(*) AS total FROM users u WHERE ${CUSTOMER_FILTER}`
    );

    return Number(row.total || 0);
  }

  async getCustomerById(id) {
    const [rows] = await db.execute(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company_name,
        u.phone,
        u.country,
        u.plan,
        u.status,
        u.role,
        u.created_at,
        u.deleted_at
      FROM users u
      WHERE u.id = ?
        AND u.role = 'customer'
        AND u.deleted_at IS NULL
      LIMIT 1
      `,
      [Number(id)]
    );

    return rows[0] || null;
  }

  async getCustomerByEmail(email) {
    const [rows] = await db.execute(
      `
      SELECT id, email, role, deleted_at
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    return rows[0] || null;
  }

  async getCustomerClients(userId) {
    const [rows] = await db.execute(
      `
      SELECT
        c.*,
        COUNT(i.id) AS invoice_count
      FROM clients c
      LEFT JOIN invoices i ON i.client_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.company_name
      `,
      [Number(userId)]
    );

    return rows;
  }

  async getCustomerInvoiceStats(userId) {
    const [[stats]] = await db.execute(
      `
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(total_amount), 0) AS invoice_total
      FROM invoices
      WHERE user_id = ?
      `,
      [Number(userId)]
    );

    return {
      invoice_count: Number(stats.invoice_count || 0),
      invoice_total: Number(stats.invoice_total || 0),
    };
  }

  async updateCustomer(id, customer) {
    await db.execute(
      `
      UPDATE users
      SET
        name = ?,
        email = ?,
        company_name = ?,
        phone = ?,
        country = ?
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      [
        customer.name,
        customer.email,
        customer.company_name,
        customer.phone || null,
        customer.country || null,
        Number(id),
      ]
    );
  }

  async updateCustomerStatus(id, status) {
    await db.execute(
      `
      UPDATE users
      SET status = ?
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      [toDbStatus(status), Number(id)]
    );
  }

  async updateCustomerPlan(id, plan) {
    await db.execute(
      `
      UPDATE users
      SET plan = ?
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      [plan, Number(id)]
    );
  }

  async updatePassword(id, password) {
    await db.execute(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      [password, Number(id)]
    );
  }

  async softDeleteCustomer(id) {
    await db.execute(
      `
      UPDATE users
      SET
        deleted_at = NOW(),
        status = 'INACTIVE'
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      [Number(id)]
    );
  }
}

module.exports = new AdminRepository();
