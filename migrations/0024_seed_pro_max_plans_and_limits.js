async function getPlanIdBySlug(db, slug) {
  const [rows] = await db.execute(`SELECT id FROM plans WHERE slug = ? LIMIT 1`, [slug]);
  return rows[0]?.id || null;
}

async function ensurePlan(db, { name, slug, monthly_price, yearly_price }) {
  const existingId = await getPlanIdBySlug(db, slug);
  if (existingId) return existingId;

  const [result] = await db.execute(
    `INSERT INTO plans (name, slug, monthly_price, yearly_price, active, featured)
     VALUES (?, ?, ?, ?, 1, 0)`,
    [name, slug, monthly_price, yearly_price]
  );
  return result.insertId;
}

async function ensurePlanLimits(db, planId, accountType, limits) {
  const [rows] = await db.execute(
    `SELECT id FROM plan_limits WHERE plan_id = ? AND account_type = ? LIMIT 1`,
    [planId, accountType]
  );
  if (rows.length) return;

  await db.execute(
    `INSERT INTO plan_limits
      (plan_id, account_type, companies_limit, customers_limit, suppliers_limit, invoices_limit)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [planId, accountType, limits.companies, limits.customers, limits.suppliers, limits.invoices]
  );
}

// Seeds the three plans this feature is built around (Free already exists
// — Pro/Max are new) and their account-type-aware limits, per the default
// table in the spec. NULL = Unlimited. `companies_limit` is only ever read
// for FREELANCER rows (a Company account's own company count is always
// exactly 1, enforced structurally elsewhere — not by this column), so it
// stays NULL/unused on COMPANY rows rather than encoding a meaningless "1".
// Starter is deactivated (not deleted — 6 real active subscriptions still
// reference it) since Free/Pro/Max are the go-forward plan set; Business/
// Enterprise were already inactive.
module.exports = {
  async up(db) {
    const freeId = await getPlanIdBySlug(db, "free");
    const proId = await ensurePlan(db, { name: "Pro", slug: "pro", monthly_price: 49, yearly_price: 490 });
    const maxId = await ensurePlan(db, { name: "Max", slug: "max", monthly_price: 149, yearly_price: 1490 });

    if (freeId) {
      await ensurePlanLimits(db, freeId, "COMPANY", {
        companies: null, customers: 5, suppliers: 5, invoices: 10,
      });
      await ensurePlanLimits(db, freeId, "FREELANCER", {
        companies: 2, customers: 5, suppliers: 5, invoices: 5,
      });
    }

    await ensurePlanLimits(db, proId, "COMPANY", {
      companies: null, customers: 100, suppliers: 100, invoices: 500,
    });
    await ensurePlanLimits(db, proId, "FREELANCER", {
      companies: 10, customers: 100, suppliers: 100, invoices: 500,
    });

    await ensurePlanLimits(db, maxId, "COMPANY", {
      companies: null, customers: null, suppliers: null, invoices: null,
    });
    await ensurePlanLimits(db, maxId, "FREELANCER", {
      companies: null, customers: null, suppliers: null, invoices: null,
    });

    await db.execute(`UPDATE plans SET active = 0 WHERE slug = 'starter'`);
  },
};
