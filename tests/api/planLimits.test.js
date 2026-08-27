const { request, app, registerAndLogin, loginAsAdmin, authed } = require("../helpers/api");
const pool = require("../../config/database");

// Seeded Free plan (tests/setup/globalSetup.js): COMPANY customers=2
// suppliers=3 invoices=5; FREELANCER companies=2, customers=2 suppliers=3
// invoices=5 per company.

function withCompany(token, companyId) {
  return { ...authed(token), "X-Company-Id": String(companyId) };
}

async function createCustomer(token, companyId, name) {
  const res = await request(app)
    .post("/api/customers")
    .set(withCompany(token, companyId))
    .send({ company_name: name });
  return res;
}

async function createSupplier(token, companyId, name) {
  const res = await request(app)
    .post("/api/suppliers")
    .set(withCompany(token, companyId))
    .send({
      company_name: name,
      email: "vendor@example.test",
      phone: "1234567890",
      billing_country: "AE",
      billing_city: "Dubai",
      trn: "100000000000000",
    });
  return res;
}

async function createFreelancerCompany(token, name) {
  const res = await request(app)
    .post("/api/companies")
    .set(authed(token))
    .send({ name });
  return res;
}

describe("Company account — plan limits", () => {
  it("blocks creating a supplier past the plan's supplier limit (seeded Free: 3)", async () => {
    const { token, user } = await registerAndLogin();
    const companyId = (await pool.execute(
      `SELECT id FROM companies WHERE owner_user_id = ? LIMIT 1`,
      [user.id]
    ))[0][0].id;

    for (let i = 0; i < 3; i++) {
      const res = await createSupplier(token, companyId, `Supplier ${i}`);
      expect(res.status).toBe(201);
    }

    const res = await createSupplier(token, companyId, "Supplier 4");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/supplier limit/i);
  });

  it("firing more concurrent supplier creations than the plan allows never lets suppliers_used exceed the limit", async () => {
    const { token, user } = await registerAndLogin();
    const companyId = (await pool.execute(
      `SELECT id FROM companies WHERE owner_user_id = ? LIMIT 1`,
      [user.id]
    ))[0][0].id;

    const CONCURRENCY = 10; // limit is 3
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        createSupplier(token, companyId, `Concurrent Supplier ${i}`)
      )
    );

    const succeeded = settled.filter(
      (r) => r.status === "fulfilled" && r.value.status === 201
    );

    expect(succeeded.length).toBe(3);

    const [[row]] = await pool.execute(
      `SELECT suppliers_used FROM usage_stats WHERE company_id = ?`,
      [companyId]
    );
    expect(row.suppliers_used).toBe(3);
  });
});

describe("Freelancer account — company limit", () => {
  it("blocks creating a third company past the plan's company limit (seeded Free: 2)", async () => {
    const { token } = await registerAndLogin({ account_type: "FREELANCER" });

    const first = await createFreelancerCompany(token, "Company One");
    expect(first.status).toBe(201);

    const second = await createFreelancerCompany(token, "Company Two");
    expect(second.status).toBe(201);

    const third = await createFreelancerCompany(token, "Company Three");
    expect(third.status).toBe(400);
    expect(third.body.error).toMatch(/company limit/i);
  });

  it("firing more concurrent company creations than the plan allows never lets companies_used exceed the limit", async () => {
    const { token, user } = await registerAndLogin({ account_type: "FREELANCER" });

    const CONCURRENCY = 8; // limit is 2
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        createFreelancerCompany(token, `Concurrent Co ${i}`)
      )
    );

    const succeeded = settled.filter(
      (r) => r.status === "fulfilled" && r.value.status === 201
    );

    expect(succeeded.length).toBe(2);

    const [[row]] = await pool.execute(
      `SELECT companies_used FROM usage_stats WHERE user_id = ? AND company_id IS NULL`,
      [user.id]
    );
    expect(row.companies_used).toBe(2);

    const [[countRow]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM companies WHERE owner_user_id = ?`,
      [user.id]
    );
    expect(countRow.total).toBe(2);
  });
});

describe("Freelancer account — per-company isolation", () => {
  it("maxing out Customers in Company A does not reduce Company B's own limit", async () => {
    const { token } = await registerAndLogin({ account_type: "FREELANCER" });

    const companyA = (await createFreelancerCompany(token, "Company A")).body.companyId;
    const companyB = (await createFreelancerCompany(token, "Company B")).body.companyId;

    // Seeded Free/FREELANCER customers-per-company limit is 2.
    for (let i = 0; i < 2; i++) {
      const res = await createCustomer(token, companyA, `A Customer ${i}`);
      expect(res.status).toBe(201);
    }

    const blockedInA = await createCustomer(token, companyA, "A Customer 3rd");
    expect(blockedInA.status).toBe(400);
    expect(blockedInA.body.error).toMatch(/customer limit/i);

    // Company B is unaffected — still has its own full 2-slot budget.
    for (let i = 0; i < 2; i++) {
      const res = await createCustomer(token, companyB, `B Customer ${i}`);
      expect(res.status).toBe(201);
    }

    const [[rowA]] = await pool.execute(
      `SELECT customers_used FROM usage_stats WHERE company_id = ?`,
      [companyA]
    );
    const [[rowB]] = await pool.execute(
      `SELECT customers_used FROM usage_stats WHERE company_id = ?`,
      [companyB]
    );

    expect(rowA.customers_used).toBe(2);
    expect(rowB.customers_used).toBe(2);
  });

  it("switching the selected company changes which company's usage is reported", async () => {
    const { token } = await registerAndLogin({ account_type: "FREELANCER" });

    const companyA = (await createFreelancerCompany(token, "ABC Trading")).body.companyId;
    const companyB = (await createFreelancerCompany(token, "XYZ Services")).body.companyId;

    await createCustomer(token, companyA, "A Customer");
    await createCustomer(token, companyB, "B Customer 1");
    await createCustomer(token, companyB, "B Customer 2");

    const usageA = await request(app).get("/api/usage").set(withCompany(token, companyA));
    const usageB = await request(app).get("/api/usage").set(withCompany(token, companyB));

    expect(usageA.body.usage.usage.customers.used).toBe(1);
    expect(usageB.body.usage.usage.customers.used).toBe(2);

    // Freelancer-level "Companies" usage is account-wide, identical no
    // matter which company happens to be currently selected.
    expect(usageA.body.usage.companies.used).toBe(2);
    expect(usageB.body.usage.companies.used).toBe(2);
    expect(usageA.body.usage.companies.limit).toBe(2);
  });
});

describe("Super Admin — dynamic plan limit configuration", () => {
  it("creates a plan with account-type-aware limits and returns them on read", async () => {
    const { token: adminToken } = await loginAsAdmin();

    const createRes = await request(app)
      .post("/api/plans")
      .set(authed(adminToken))
      .send({
        name: `Test Pro ${Date.now()}`,
        slug: `test-pro-${Date.now()}`,
        monthly_price: 49,
        yearly_price: 490,
        invoice_limit: 500,
        customer_limit: 100,
        user_limit: 5,
        storage_limit: 5000,
        ocr_limit: 500,
        active: 1,
        api_access: 0,
        priority_support: 0,
        featured: 0,
        limits: {
          company: { customers_limit: 100, suppliers_limit: 100, invoices_limit: 500 },
          freelancer: { companies_limit: 10, customers_limit: 100, suppliers_limit: 100, invoices_limit: 500 },
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.plan.limits.company.customers_limit).toBe(100);
    expect(createRes.body.plan.limits.freelancer.companies_limit).toBe(10);

    const getRes = await request(app)
      .get(`/api/plans/${createRes.body.plan.id}`)
      .set(authed(adminToken));

    expect(getRes.body.plan.limits.freelancer.invoices_limit).toBe(500);
  });

  it("supports an explicit Unlimited configuration (null) rather than a large number", async () => {
    const { token: adminToken } = await loginAsAdmin();

    const createRes = await request(app)
      .post("/api/plans")
      .set(authed(adminToken))
      .send({
        name: `Test Max ${Date.now()}`,
        slug: `test-max-${Date.now()}`,
        monthly_price: 149,
        yearly_price: 1490,
        invoice_limit: 999999,
        customer_limit: 999999,
        user_limit: 999,
        storage_limit: 100000,
        ocr_limit: 999999,
        active: 1,
        api_access: 0,
        priority_support: 0,
        featured: 0,
        limits: {
          company: { customers_limit: null, suppliers_limit: null, invoices_limit: null },
          freelancer: { companies_limit: null, customers_limit: null, suppliers_limit: null, invoices_limit: null },
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.plan.limits.company.customers_limit).toBeNull();
    expect(createRes.body.plan.limits.freelancer.companies_limit).toBeNull();
  });

  it("changing a plan's limit takes effect immediately for existing subscribers, no redeploy required", async () => {
    const { token: adminToken } = await loginAsAdmin();
    const { token, user } = await registerAndLogin({ account_type: "FREELANCER" });

    // Free plan's company limit starts at 2 (seeded fixture).
    await createFreelancerCompany(token, "Co One");
    await createFreelancerCompany(token, "Co Two");

    const blocked = await createFreelancerCompany(token, "Co Three");
    expect(blocked.status).toBe(400);

    const [[freePlan]] = await pool.execute(`SELECT id FROM plans WHERE slug = 'free' LIMIT 1`);

    const updateRes = await request(app)
      .put(`/api/plans/${freePlan.id}`)
      .set(authed(adminToken))
      .send({
        name: "Free",
        slug: "free",
        monthly_price: 0,
        yearly_price: 0,
        invoice_limit: 5,
        customer_limit: 2,
        user_limit: 1,
        storage_limit: 50,
        ocr_limit: 5,
        active: 1,
        api_access: 0,
        priority_support: 0,
        featured: 0,
        limits: {
          company: { customers_limit: 2, suppliers_limit: 3, invoices_limit: 5 },
          freelancer: { companies_limit: 3, customers_limit: 2, suppliers_limit: 3, invoices_limit: 5 },
        },
      });

    expect(updateRes.status).toBe(200);

    // Same Freelancer, no re-login/redeploy — the new cap applies right away.
    const nowAllowed = await createFreelancerCompany(token, "Co Three Retry");
    expect(nowAllowed.status).toBe(201);

    // Restore the fixture's original limit so later tests in this run
    // aren't affected by this test's mutation of the shared seeded plan.
    await request(app)
      .put(`/api/plans/${freePlan.id}`)
      .set(authed(adminToken))
      .send({
        name: "Free",
        slug: "free",
        monthly_price: 0,
        yearly_price: 0,
        invoice_limit: 5,
        customer_limit: 2,
        user_limit: 1,
        storage_limit: 50,
        ocr_limit: 5,
        active: 1,
        api_access: 0,
        priority_support: 0,
        featured: 0,
        limits: {
          company: { customers_limit: 2, suppliers_limit: 3, invoices_limit: 5 },
          freelancer: { companies_limit: 2, customers_limit: 2, suppliers_limit: 3, invoices_limit: 5 },
        },
      });
  });
});
