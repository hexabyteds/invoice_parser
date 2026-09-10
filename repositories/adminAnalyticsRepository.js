const db = require("../config/database");

const RANGE_DAYS = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "12m": 365,
};

function daysFor(range) {
  return RANGE_DAYS[range] || 30;
}

class AdminAnalyticsRepository {
  async getSummary() {
    const [[users]] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN account_type = 'FREELANCER' THEN 1 ELSE 0 END) AS freelancers
      FROM users
      WHERE role = 'customer' AND deleted_at IS NULL
    `);

    const [[companies]] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active
      FROM companies
    `);

    // A Freelancer counted "active" if they own at least one ACTIVE
    // company membership as OWNER on an ACTIVE company — mirrors the same
    // signal companyContext.js itself uses to grant access.
    const [[activeFreelancers]] = await db.execute(`
      SELECT COUNT(DISTINCT u.id) AS total
      FROM users u
      JOIN company_memberships m ON m.user_id = u.id AND m.role = 'OWNER' AND m.status = 'ACTIVE'
      JOIN companies c ON c.id = m.company_id AND c.status = 'ACTIVE'
      WHERE u.account_type = 'FREELANCER'
    `);

    const [[businessData]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM customers) AS total_customers,
        (SELECT COUNT(*) FROM suppliers) AS total_suppliers,
        (SELECT COUNT(*) FROM invoices WHERE document_type = 'supplier_invoice') AS total_invoices,
        (SELECT COUNT(*) FROM invoices WHERE document_type = 'bill') AS total_bills,
        (SELECT COUNT(*) FROM bank_statements) AS total_bank_statements,
        (SELECT COUNT(*) FROM invoices WHERE status = 'PROCESSED') +
          (SELECT COUNT(*) FROM bank_statements WHERE status = 'PROCESSED') AS total_processed,
        (SELECT COUNT(*) FROM invoices WHERE status = 'FAILED') +
          (SELECT COUNT(*) FROM bank_statements WHERE status = 'FAILED') AS total_failed
    `);

    const [[subs]] = await db.execute(`
      SELECT COUNT(*) AS active FROM subscriptions WHERE status = 'active'
    `);

    const [[revenue]] = await db.execute(`
      SELECT
        COALESCE(SUM(
          CASE WHEN s.billing_cycle = 'yearly' THEN s.price / 12 ELSE s.price END
        ), 0) AS mrr
      FROM subscriptions s
      WHERE s.status = 'active'
    `);

    return {
      totalUsers: Number(users.total || 0),
      totalFreelancers: Number(users.freelancers || 0),
      totalCompanies: Number(companies.total || 0),
      activeCompanies: Number(companies.active || 0),
      activeFreelancers: Number(activeFreelancers.total || 0),
      totalCustomers: Number(businessData.total_customers || 0),
      totalSuppliers: Number(businessData.total_suppliers || 0),
      totalInvoices: Number(businessData.total_invoices || 0),
      totalBills: Number(businessData.total_bills || 0),
      totalBankStatements: Number(businessData.total_bank_statements || 0),
      totalDocumentsProcessed: Number(businessData.total_processed || 0),
      failedDocuments: Number(businessData.total_failed || 0),
      activeSubscriptions: Number(subs.active || 0),
      mrr: Number(revenue.mrr || 0),
    };
  }

  async getGrowth(metric, range) {
    const days = daysFor(range);

    const tableByMetric = {
      users: `SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE role = 'customer' AND deleted_at IS NULL AND account_type = 'COMPANY' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(created_at)`,
      companies: `SELECT DATE(created_at) AS d, COUNT(*) AS c FROM companies WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(created_at)`,
      freelancers: `SELECT DATE(created_at) AS d, COUNT(*) AS c FROM users WHERE role = 'customer' AND deleted_at IS NULL AND account_type = 'FREELANCER' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(created_at)`,
    };

    const sql = tableByMetric[metric] || tableByMetric.users;
    const [rows] = await db.query(sql, [days]);

    return rows.map((r) => ({ date: r.d, count: Number(r.c) }));
  }

  async getDocumentGrowth(range) {
    const days = daysFor(range);

    const [rows] = await db.query(
      `
      SELECT
        DATE(created_at) AS d,
        SUM(CASE WHEN document_type = 'supplier_invoice' THEN 1 ELSE 0 END) AS invoices,
        SUM(CASE WHEN document_type = 'bill' THEN 1 ELSE 0 END) AS bills,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed
      FROM invoices
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY d ASC
      `,
      [days]
    );

    return rows.map((r) => ({
      date: r.d,
      invoices: Number(r.invoices || 0),
      bills: Number(r.bills || 0),
      failed: Number(r.failed || 0),
    }));
  }

  async getPlanDistribution() {
    const [rows] = await db.query(`
      SELECT
        owner.account_type,
        p.slug AS plan_slug,
        p.name AS plan_name,
        COUNT(*) AS count
      FROM companies co
      JOIN users owner ON owner.id = co.owner_user_id
      LEFT JOIN subscriptions company_sub
        ON company_sub.company_id = co.id AND company_sub.status IN ('active', 'trial')
      LEFT JOIN subscriptions freelancer_sub
        ON freelancer_sub.user_id = co.owner_user_id
        AND freelancer_sub.company_id IS NULL
        AND freelancer_sub.status IN ('active', 'trial')
        AND owner.account_type = 'FREELANCER'
      LEFT JOIN plans p ON p.id = COALESCE(freelancer_sub.plan_id, company_sub.plan_id)
      GROUP BY owner.account_type, p.slug, p.name
    `);

    return rows;
  }

  // Upgrade/downgrade counts — derived honestly from real subscription
  // history (a new row is inserted and the old one marked 'expired' on
  // every plan change, see subscriptionService.changePlan) rather than a
  // separate events table. Compares each owner's subscriptions in
  // creation order and classifies each transition by monthly_price delta.
  async getPlanChanges(range) {
    const days = daysFor(range);

    const [rows] = await db.query(
      `
      SELECT
        s.id, s.user_id, s.company_id, s.plan_id, s.created_at, p.monthly_price
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY COALESCE(s.company_id, -s.user_id), s.created_at ASC
      `,
      [days]
    );

    // Group by the billing owner (company_id, or user_id when it's a
    // Freelancer's own account-level row) and walk each group in order.
    const byOwner = new Map();
    for (const row of rows) {
      const key = row.company_id ? `c:${row.company_id}` : `u:${row.user_id}`;
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push(row);
    }

    let upgrades = 0;
    let downgrades = 0;

    for (const history of byOwner.values()) {
      for (let i = 1; i < history.length; i++) {
        const prevPrice = Number(history[i - 1].monthly_price);
        const nextPrice = Number(history[i].monthly_price);
        if (nextPrice > prevPrice) upgrades += 1;
        else if (nextPrice < prevPrice) downgrades += 1;
      }
    }

    return { upgrades, downgrades };
  }

  async getFreelancerAnalytics() {
    const [[counts]] = await db.execute(`
      SELECT
        COUNT(*) AS total_freelancers
      FROM users WHERE account_type = 'FREELANCER' AND deleted_at IS NULL
    `);

    const [[freelancerAgg]] = await db.execute(`
      SELECT
        COUNT(*) AS freelancers_with_companies,
        AVG(company_count) AS avg_companies,
        MAX(company_count) AS max_companies,
        SUM(company_count) AS total_managed
      FROM (
        SELECT co.owner_user_id, COUNT(*) AS company_count
        FROM companies co
        JOIN users u ON u.id = co.owner_user_id AND u.account_type = 'FREELANCER'
        GROUP BY co.owner_user_id
      ) t
    `);

    const [mostActive] = await db.query(`
      SELECT
        u.id, u.name, u.email,
        COUNT(DISTINCT co.id) AS companies_managed,
        COALESCE(doc_counts.doc_count, 0) AS document_count
      FROM users u
      JOIN companies co ON co.owner_user_id = u.id
      LEFT JOIN (
        SELECT co2.owner_user_id AS owner_id, COUNT(*) AS doc_count
        FROM invoices i
        JOIN companies co2 ON co2.id = i.company_id
        GROUP BY co2.owner_user_id
      ) doc_counts ON doc_counts.owner_id = u.id
      WHERE u.account_type = 'FREELANCER'
      GROUP BY u.id, u.name, u.email, doc_counts.doc_count
      ORDER BY document_count DESC
      LIMIT 10
    `);

    return {
      totalFreelancers: Number(counts.total_freelancers || 0),
      freelancersWithCompanies: Number(freelancerAgg.freelancers_with_companies || 0),
      avgCompaniesPerFreelancer: Number(freelancerAgg.avg_companies || 0),
      maxCompaniesManaged: Number(freelancerAgg.max_companies || 0),
      totalManagedCompanies: Number(freelancerAgg.total_managed || 0),
      mostActive: mostActive.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        companiesManaged: Number(r.companies_managed || 0),
        documentCount: Number(r.document_count || 0),
      })),
    };
  }
}

module.exports = new AdminAnalyticsRepository();
