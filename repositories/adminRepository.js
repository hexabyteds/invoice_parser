const db = require("../config/database");
const { toDbStatus } = require("../utils/userStatus");

const CUSTOMER_FILTER = `
  u.role = 'customer'
  AND u.deleted_at IS NULL
`;

// Optional free-text search over the two fields an admin actually has to
// hand when looking someone up: their email and their company name.
// Returns a WHERE fragment + its params so the list query and the count
// query that paginates it can't drift apart.
function buildCustomerSearch(search) {
  const term = String(search || "").trim();

  if (!term) {
    return { clause: "", params: [] };
  }

  const like = `%${term}%`;

  return {
    clause: ` AND (u.email LIKE ? OR u.company_name LIKE ?)`,
    params: [like, like],
  };
}

class AdminRepository {
  async getPlatformStats() {
    const [[customerStats]] = await db.execute(`
      SELECT
        COUNT(*) AS total_customers,
        SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END) AS active_subscriptions,
        SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified_accounts,
        SUM(CASE WHEN email_verified = 0 OR email_verified IS NULL THEN 1 ELSE 0 END) AS unverified_accounts
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

    // Real MRR from what customers are actually subscribed at (subscriptions.price,
    // normalized to a monthly figure), not a hardcoded price guess keyed off the
    // legacy users.plan enum (SUB-06) — that ignored admin-edited plan prices
    // entirely and silently priced any plan outside its hardcoded map at $0.
    // Joined against users so a soft-deleted customer's still-"active" row
    // (soft delete never cancels subscriptions) doesn't count either.
    const [[revenueStats]] = await db.execute(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN s.billing_cycle = 'yearly' THEN s.price / 12
            ELSE s.price
          END
        ), 0) AS monthly_revenue
      FROM subscriptions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active'
        AND u.role = 'customer'
        AND u.deleted_at IS NULL
    `);

    return {
      totalCustomers: Number(customerStats.total_customers || 0),
      activeSubscriptions: Number(customerStats.active_subscriptions || 0),
      verifiedAccounts: Number(customerStats.verified_accounts || 0),
      unverifiedAccounts: Number(customerStats.unverified_accounts || 0),
      totalInvoices: Number(invoiceStats.total_invoices || 0),
      invoiceVolume: Number(invoiceStats.invoice_volume || 0),
      monthlyRevenue: Number(revenueStats.monthly_revenue || 0),
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
        u.account_type,
        u.plan,
        u.status,
        u.created_at,
        (SELECT COUNT(*) FROM customers c WHERE c.user_id = u.id) AS client_count,
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
  async getAllCustomers({ limit = 20, offset = 0, search = "" } = {}) {
    const { clause, params } = buildCustomerSearch(search);

    const [rows] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company_name,
        u.account_type,
        u.plan,
        u.status,
        u.created_at,
        u.email_verified,
        COALESCE(client_counts.client_count, 0) AS client_count,
        COALESCE(invoice_stats.invoice_count, 0) AS invoice_count,
        COALESCE(invoice_stats.invoice_total, 0) AS invoice_total
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS client_count
        FROM customers
        GROUP BY user_id
      ) client_counts ON client_counts.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS invoice_count, COALESCE(SUM(total_amount), 0) AS invoice_total
        FROM invoices
        GROUP BY user_id
      ) invoice_stats ON invoice_stats.user_id = u.id
      WHERE ${CUSTOMER_FILTER}${clause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return rows;
  }

  async countAllCustomers({ search = "" } = {}) {
    const { clause, params } = buildCustomerSearch(search);

    const [[row]] = await db.execute(
      `SELECT COUNT(*) AS total FROM users u WHERE ${CUSTOMER_FILTER}${clause}`,
      params
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
        u.account_type,
        u.phone,
        u.country,
        u.country_code,
        u.mobile_number,
        u.email_verified,
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

  // Company-scoped, not user-scoped — a COMPANY account's clients/invoices
  // are shared with its whole team (see the Dashboard fix this mirrors),
  // so counting only rows this specific user_id created would undercount
  // for any company with more than one active uploader. companyId is null
  // for a FREELANCER (who owns no company of their own) — callers get an
  // empty result rather than a query with no filter at all.
  async getCustomerClients(companyId) {
    if (!companyId) return [];

    const [rows] = await db.execute(
      `
      SELECT
        c.*,
        COUNT(i.id) AS invoice_count
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      WHERE c.company_id = ?
      GROUP BY c.id
      ORDER BY c.company_name
      `,
      [Number(companyId)]
    );

    return rows;
  }

  async getCustomerInvoiceStats(companyId) {
    if (!companyId) return { invoice_count: 0, invoice_total: 0 };

    const [[stats]] = await db.execute(
      `
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(total_amount), 0) AS invoice_total
      FROM invoices
      WHERE company_id = ?
      `,
      [Number(companyId)]
    );

    return {
      invoice_count: Number(stats.invoice_count || 0),
      invoice_total: Number(stats.invoice_total || 0),
    };
  }

  async updateCustomer(id, customer) {
    // country/country_code/mobile_number are only included in the SET
    // clause when the caller explicitly touched them (see
    // adminService.updateCustomer) — same "leave untouched unless
    // provided" pattern as userRepository.update.
    const fields = ["name = ?", "email = ?", "company_name = ?", "phone = ?"];
    const params = [
      customer.name,
      customer.email,
      customer.company_name,
      customer.phone || null,
    ];

    if (customer.country !== undefined) {
      fields.push("country = ?");
      params.push(customer.country);
    }

    if (customer.country_code !== undefined) {
      fields.push("country_code = ?");
      params.push(customer.country_code);
    }

    if (customer.mobile_number !== undefined) {
      fields.push("mobile_number = ?");
      params.push(customer.mobile_number);
    }

    params.push(Number(id));

    await db.execute(
      `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      params
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
    // users.email has a UNIQUE constraint at the DB level (schema.sql),
    // which findByEmail's `deleted_at IS NULL` filter alone can't get
    // around — the pre-check would say the email is free, but the
    // INSERT still hits the raw constraint against this still-intact
    // row and fails with an unhandled "Duplicate entry" error (SUB-10).
    // Mangle the email here so it's actually free at the DB level, not
    // just skipped by application-side lookups. Original stays
    // recoverable by stripping the "deleted_<id>_<ts>_" prefix.
    await db.execute(
      `
      UPDATE users
      SET
        deleted_at = NOW(),
        status = 'INACTIVE',
        email = LEFT(CONCAT('deleted_', id, '_', UNIX_TIMESTAMP(), '_', email), 255)
      WHERE id = ?
        AND role = 'customer'
        AND deleted_at IS NULL
      `,
      [Number(id)]
    );
  }
}

module.exports = new AdminRepository();
