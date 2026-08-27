const db = require("../config/database");

// Every company's "effective plan" mirrors usageService.getPlanLimits'
// resolution: a Company account's own plan comes from its own subscription
// row; a Freelancer-owned company's plan comes from the Freelancer's own
// account-level subscription (company_id IS NULL) instead — see the
// Dynamic Usage & Plan Management work this builds on. Duplicated here as
// SQL (rather than calling usageService per row) because the admin list
// needs to search/filter/paginate across potentially thousands of
// companies in one query — looping a per-row service call wouldn't scale.
const PLAN_JOIN = `
  LEFT JOIN subscriptions company_sub
    ON company_sub.company_id = co.id AND company_sub.status = 'active'
  LEFT JOIN subscriptions freelancer_sub
    ON freelancer_sub.user_id = co.owner_user_id
    AND freelancer_sub.company_id IS NULL
    AND freelancer_sub.status = 'active'
    AND owner.account_type = 'FREELANCER'
  LEFT JOIN plans p
    ON p.id = COALESCE(freelancer_sub.plan_id, company_sub.plan_id)
  LEFT JOIN plan_limits pl
    ON pl.plan_id = p.id AND pl.account_type = owner.account_type
`;

const COUNTS_JOIN = `
  LEFT JOIN (SELECT company_id, COUNT(*) AS cnt FROM customers GROUP BY company_id) cust
    ON cust.company_id = co.id
  LEFT JOIN (SELECT company_id, COUNT(*) AS cnt FROM suppliers GROUP BY company_id) supp
    ON supp.company_id = co.id
  LEFT JOIN (SELECT company_id, COUNT(*) AS cnt FROM invoices WHERE document_type = 'supplier_invoice' GROUP BY company_id) inv
    ON inv.company_id = co.id
  LEFT JOIN (SELECT company_id, COUNT(*) AS cnt FROM invoices WHERE document_type = 'bill' GROUP BY company_id) bill
    ON bill.company_id = co.id
  LEFT JOIN (SELECT company_id, COUNT(*) AS cnt FROM bank_statements GROUP BY company_id) bs
    ON bs.company_id = co.id
  LEFT JOIN (SELECT company_id, MAX(last_active_at) AS last_active FROM company_memberships GROUP BY company_id) mem
    ON mem.company_id = co.id
`;

// NULL limit = Unlimited -> ratio 0 (never near/at limit). limit = 0 with
// usage > 0 -> ratio 1 (immediately "reached"), avoiding a divide-by-zero.
function ratioExpr(usedCol, limitCol) {
  return `
    CASE
      WHEN ${limitCol} IS NULL THEN 0
      WHEN ${limitCol} = 0 THEN (CASE WHEN ${usedCol} > 0 THEN 1 ELSE 0 END)
      ELSE ${usedCol} / ${limitCol}
    END
  `;
}

const USAGE_RATIO_EXPR = `
  GREATEST(
    ${ratioExpr("COALESCE(cust.cnt, 0)", "pl.customers_limit")},
    ${ratioExpr("COALESCE(supp.cnt, 0)", "pl.suppliers_limit")},
    ${ratioExpr("COALESCE(inv.cnt, 0)", "pl.invoices_limit")}
  )
`;

function buildFilters({ search, plan, status, source, usage, dateFrom, dateTo }) {
  const where = [];
  const having = [];
  const params = [];

  if (search) {
    const like = `%${search}%`;
    where.push(`
      (co.name LIKE ? OR co.legal_name LIKE ? OR co.email LIKE ? OR co.phone LIKE ?
       OR co.trn LIKE ? OR CAST(co.id AS CHAR) LIKE ? OR owner.name LIKE ? OR owner.email LIKE ?)
    `);
    params.push(like, like, like, like, like, like, like, like);
  }

  if (plan && plan !== "all") {
    where.push(`p.slug = ?`);
    params.push(plan);
  }

  if (status && status !== "all") {
    where.push(`co.status = ?`);
    params.push(status.toUpperCase());
  }

  if (source === "direct") {
    where.push(`owner.account_type = 'COMPANY'`);
  } else if (source === "freelancer_created") {
    where.push(`owner.account_type = 'FREELANCER'`);
  } else if (source === "freelancer_managed") {
    where.push(`
      EXISTS (
        SELECT 1 FROM company_memberships cm
        WHERE cm.company_id = co.id AND cm.role != 'OWNER' AND cm.status = 'ACTIVE'
      )
    `);
  }

  if (dateFrom) {
    where.push(`co.created_at >= ?`);
    params.push(dateFrom);
  }

  if (dateTo) {
    where.push(`co.created_at <= ?`);
    params.push(dateTo);
  }

  if (usage === "near") {
    having.push(`usage_ratio >= 0.7 AND usage_ratio < 1`);
  } else if (usage === "reached") {
    having.push(`usage_ratio >= 1`);
  } else if (usage === "normal") {
    having.push(`usage_ratio < 0.7`);
  }

  return { where, having, params };
}

class AdminCompanyRepository {
  async getSummary() {
    const [[counts]] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended,
        SUM(CASE WHEN status = 'DEACTIVATED' THEN 1 ELSE 0 END) AS deactivated,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS recent
      FROM companies
    `);

    const [[planCounts]] = await db.execute(`
      SELECT
        SUM(CASE WHEN p.slug = 'free' THEN 1 ELSE 0 END) AS free_count,
        SUM(CASE WHEN p.slug = 'pro' THEN 1 ELSE 0 END) AS pro_count,
        SUM(CASE WHEN p.slug = 'max' THEN 1 ELSE 0 END) AS max_count
      FROM companies co
      JOIN users owner ON owner.id = co.owner_user_id
      ${PLAN_JOIN}
    `);

    const [[usageCounts]] = await db.execute(`
      SELECT
        SUM(CASE WHEN usage_ratio >= 0.7 AND usage_ratio < 1 THEN 1 ELSE 0 END) AS near_limit,
        SUM(CASE WHEN usage_ratio >= 1 THEN 1 ELSE 0 END) AS limit_reached
      FROM (
        SELECT ${USAGE_RATIO_EXPR} AS usage_ratio
        FROM companies co
        JOIN users owner ON owner.id = co.owner_user_id
        ${PLAN_JOIN}
        ${COUNTS_JOIN}
      ) ratios
    `);

    return {
      total: Number(counts.total || 0),
      active: Number(counts.active || 0),
      suspended: Number(counts.suspended || 0),
      deactivated: Number(counts.deactivated || 0),
      recentlyCreated: Number(counts.recent || 0),
      freePlan: Number(planCounts.free_count || 0),
      proPlan: Number(planCounts.pro_count || 0),
      maxPlan: Number(planCounts.max_count || 0),
      nearLimit: Number(usageCounts.near_limit || 0),
      limitReached: Number(usageCounts.limit_reached || 0),
    };
  }

  async getAll({ limit = 20, offset = 0, ...filters } = {}) {
    const { where, having, params } = buildFilters(filters);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const havingSql = having.length ? `HAVING ${having.join(" AND ")}` : "";

    const [rows] = await db.query(
      `
      SELECT
        co.id, co.name, co.legal_name, co.status, co.created_at,
        co.email, co.phone, co.trn,
        owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
        owner.account_type AS owner_account_type,
        p.name AS plan_name, p.slug AS plan_slug,
        COALESCE(cust.cnt, 0) AS customers_count,
        COALESCE(supp.cnt, 0) AS suppliers_count,
        COALESCE(inv.cnt, 0) AS invoices_count,
        COALESCE(bill.cnt, 0) AS bills_count,
        COALESCE(bs.cnt, 0) AS bank_statements_count,
        mem.last_active AS last_activity,
        ${USAGE_RATIO_EXPR} AS usage_ratio
      FROM companies co
      JOIN users owner ON owner.id = co.owner_user_id
      ${PLAN_JOIN}
      ${COUNTS_JOIN}
      ${whereSql}
      ${havingSql}
      ORDER BY co.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return rows;
  }

  async countAll(filters = {}) {
    const { where, having, params } = buildFilters(filters);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const havingSql = having.length ? `HAVING ${having.join(" AND ")}` : "";

    // HAVING (the usage filter) needs the same ratio expression as the
    // list query to count consistently — cheapest correct way to count
    // through a HAVING clause is wrapping it as a subquery.
    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total FROM (
        SELECT co.id, ${USAGE_RATIO_EXPR} AS usage_ratio
        FROM companies co
        JOIN users owner ON owner.id = co.owner_user_id
        ${PLAN_JOIN}
        ${COUNTS_JOIN}
        ${whereSql}
        ${havingSql}
      ) filtered
      `,
      params
    );

    return Number(rows[0]?.total || 0);
  }

  // Top N companies closest to (or at) their plan's limit, for the
  // Analytics "Usage" section and its click-through to Company Detail —
  // reuses the exact same ratio computation as the Companies list's Usage
  // filter, not a second definition of "near limit".
  async getNearLimitCompanies(limit = 10) {
    const [rows] = await db.query(
      `
      SELECT
        co.id, co.name, co.status,
        COALESCE(cust.cnt, 0) AS customers_count, pl.customers_limit,
        COALESCE(supp.cnt, 0) AS suppliers_count, pl.suppliers_limit,
        COALESCE(inv.cnt, 0) AS invoices_count, pl.invoices_limit,
        ${USAGE_RATIO_EXPR} AS usage_ratio
      FROM companies co
      JOIN users owner ON owner.id = co.owner_user_id
      ${PLAN_JOIN}
      ${COUNTS_JOIN}
      HAVING usage_ratio >= 0.7
      ORDER BY usage_ratio DESC
      LIMIT ?
      `,
      [limit]
    );

    return rows;
  }

  async getById(companyId) {
    const [rows] = await db.execute(
      `
      SELECT
        co.*,
        owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
        owner.account_type AS owner_account_type, owner.phone AS owner_phone,
        owner.country AS owner_country, owner.stripe_customer_id AS owner_stripe_customer_id,
        p.id AS plan_id, p.name AS plan_name, p.slug AS plan_slug,
        COALESCE(freelancer_sub.id, company_sub.id) AS subscription_id,
        COALESCE(freelancer_sub.status, company_sub.status) AS subscription_status,
        COALESCE(freelancer_sub.billing_cycle, company_sub.billing_cycle) AS billing_cycle,
        COALESCE(freelancer_sub.price, company_sub.price) AS price,
        COALESCE(freelancer_sub.starts_at, company_sub.starts_at) AS starts_at,
        COALESCE(freelancer_sub.expires_at, company_sub.expires_at) AS expires_at,
        COALESCE(freelancer_sub.next_billing, company_sub.next_billing) AS next_billing,
        COALESCE(freelancer_sub.cancelled_at, company_sub.cancelled_at) AS cancelled_at,
        COALESCE(freelancer_sub.cancel_at_period_end, company_sub.cancel_at_period_end) AS cancel_at_period_end,
        COALESCE(freelancer_sub.stripe_status, company_sub.stripe_status) AS stripe_status,
        pl.customers_limit, pl.suppliers_limit, pl.invoices_limit, pl.companies_limit
      FROM companies co
      JOIN users owner ON owner.id = co.owner_user_id
      ${PLAN_JOIN}
      WHERE co.id = ?
      LIMIT 1
      `,
      [companyId]
    );

    return rows[0] || null;
  }

  async getBusinessDataCounts(companyId) {
    const [[row]] = await db.execute(
      `
      SELECT
        (SELECT COUNT(*) FROM customers WHERE company_id = ?) AS customers_count,
        (SELECT COUNT(*) FROM suppliers WHERE company_id = ?) AS suppliers_count,
        (SELECT COUNT(*) FROM invoices WHERE company_id = ? AND document_type = 'supplier_invoice') AS invoices_count,
        (SELECT COUNT(*) FROM invoices WHERE company_id = ? AND document_type = 'bill') AS bills_count,
        (SELECT COUNT(*) FROM bank_statements WHERE company_id = ?) AS bank_statements_count
      `,
      [companyId, companyId, companyId, companyId, companyId]
    );

    return row;
  }

  // Other companies the same Freelancer owns, excluding this one — §7's
  // "Managed Companies" list. Empty for a Company-owned company.
  async getFreelancerOtherCompanies(freelancerUserId, excludeCompanyId) {
    const [rows] = await db.execute(
      `
      SELECT id, name, status
      FROM companies
      WHERE owner_user_id = ? AND id != ?
      ORDER BY created_at DESC
      `,
      [freelancerUserId, excludeCompanyId]
    );

    return rows;
  }

  async getLastLogin(userId) {
    const [rows] = await db.execute(
      `
      SELECT login_time FROM login_history
      WHERE user_id = ?
      ORDER BY login_time DESC
      LIMIT 1
      `,
      [userId]
    );

    return rows[0]?.login_time || null;
  }

  // Every invoice/bill/bank-statement upload event already carries
  // company_id (see app-backend.js's auditLogRepository.create calls) —
  // this is the only event category actually logged today (see
  // auditLogRepository's module note in adminCompanyService for the
  // honest caveat surfaced to the UI).
  async getActivity(companyId, limit = 30) {
    const [rows] = await db.query(
      `
      SELECT al.id, al.action, al.description, al.created_at, u.name AS actor_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.company_id = ?
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
      `,
      [companyId, limit]
    );

    return rows;
  }
}

module.exports = new AdminCompanyRepository();
