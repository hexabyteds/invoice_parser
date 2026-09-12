const { request, app, registerAndLogin, loginAsAdmin, authed } = require("../helpers/api");
const pool = require("../../config/database");

const ADMIN_GET_ENDPOINTS = [
  "/api/admin/stats",
  "/api/admin/customers",
  "/api/admin/subscriptions",
];

describe("Admin — role-based access control", () => {
  for (const endpoint of ADMIN_GET_ENDPOINTS) {
    it(`${endpoint} rejects unauthenticated requests (401)`, async () => {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
    });

    it(`${endpoint} rejects a regular customer (403)`, async () => {
      const { token } = await registerAndLogin();
      const res = await request(app).get(endpoint).set(authed(token));
      expect(res.status).toBe(403);
    });

    it(`${endpoint} allows the seeded admin (200)`, async () => {
      const { token } = await loginAsAdmin();
      const res = await request(app).get(endpoint).set(authed(token));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  }

  it("cannot escalate to admin by sending role in the request body", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/admin/customers")
      .set(authed(token))
      .send({ role: "admin" });

    expect(res.status).toBe(403);
  });

  it("rejects a token whose signature doesn't match JWT_SECRET", async () => {
    const jwt = require("jsonwebtoken");
    const forged = jwt.sign({ id: 999999, email: "x@x.test", role: "admin" }, "wrong-secret");

    const res = await request(app)
      .get("/api/admin/customers")
      .set(authed(forged));

    expect(res.status).toBe(401);
  });
});

describe("Admin — cross-user visibility (the flip side of client/invoice isolation)", () => {
  it("admin can see a regular user's client that the user itself owns", async () => {
    const { token: userToken } = await registerAndLogin();

    const created = await request(app)
      .post("/api/customers")
      .set(authed(userToken))
      .send({ company_name: "Visible To Admin Co" });

    const { token: adminToken } = await loginAsAdmin();

    const list = await request(app)
      .get("/api/admin/customers")
      .set(authed(adminToken));

    expect(list.status).toBe(200);
    const customerId = created.body.customer.user_id;

    const details = await request(app)
      .get(`/api/admin/customers/${customerId}`)
      .set(authed(adminToken));

    expect(details.status).toBe(200);
    expect(
      details.body.clients.some((c) => c.company_name === "Visible To Admin Co")
    ).toBe(true);
  });
});

describe("Admin — customer login history", () => {
  it("rejects unauthenticated requests (401)", async () => {
    const { user } = await registerAndLogin();

    const res = await request(app).get(
      `/api/admin/customers/${user.id}/login-history`
    );

    expect(res.status).toBe(401);
  });

  it("rejects a regular customer (403)", async () => {
    const { token, user } = await registerAndLogin();

    const res = await request(app)
      .get(`/api/admin/customers/${user.id}/login-history`)
      .set(authed(token));

    expect(res.status).toBe(403);
  });

  it("404s for a customer id that doesn't exist", async () => {
    const { token: adminToken } = await loginAsAdmin();

    const res = await request(app)
      .get("/api/admin/customers/999999999/login-history")
      .set(authed(adminToken));

    expect(res.status).toBe(404);
  });

  it("lets the admin see a customer's login history after that customer logs in", async () => {
    const { email, password, user } = await registerAndLogin();
    const { token: adminToken } = await loginAsAdmin();

    await request(app)
      .post("/api/auth/login")
      .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1")
      .send({ email, password });

    const res = await request(app)
      .get(`/api/admin/customers/${user.id}/login-history`)
      .set(authed(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.history.length).toBe(1);
    expect(res.body.history[0].device).toBe("iPhone");
  });
});

describe("Admin — subscription cancellation visibility (BUG-BILLING-002)", () => {
  it("surfaces cancel_at_period_end and stripe_status so a canceling subscription doesn't look like a normal active one", async () => {
    const { user } = await registerAndLogin();
    const admin = await loginAsAdmin();

    const [[plan]] = await pool.execute(
      `SELECT id FROM plans WHERE slug = 'starter' LIMIT 1`
    );

    await request(app)
      .post("/api/subscriptions/change-plan")
      .set(authed(admin.token))
      .send({ userId: user.id, planId: plan.id, billingCycle: "monthly" });

    // Simulates a Stripe-backed subscription that's been scheduled to
    // cancel at period end — the same DB state the real cancel flow
    // produces (see tests/api/stripe-checkout.test.js for that flow).
    await pool.execute(
      `UPDATE subscriptions
       SET stripe_subscription_id = ?, stripe_status = 'active', cancel_at_period_end = 1
       WHERE user_id = ? AND status = 'active'`,
      [`sub_admin_visibility_${user.id}`, user.id]
    );

    const res = await request(app)
      .get("/api/admin/subscriptions")
      .set(authed(admin.token));

    expect(res.status).toBe(200);

    // getAllSubscriptions() returns full history, not just the active row
    // (the user's original expired Free-plan row is in there too, and can
    // tie on created_at with the new row) — status disambiguates which
    // row is the one this test actually updated.
    const row = res.body.subscriptions.find(
      (s) => s.user_id === user.id && s.status === "active"
    );
    expect(row).toBeDefined();
    expect(row.cancel_at_period_end).toBe(true);
    expect(row.stripe_status).toBe("active");
  });
});

describe("Admin — customer search", () => {
  let admin;

  beforeAll(async () => {
    admin = await loginAsAdmin();
  });

  it("finds a customer by their email address", async () => {
    const { user } = await registerAndLogin();

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: user.email })
      .set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(1);
    expect(res.body.customers[0].id).toBe(user.id);
    expect(res.body.pagination.total).toBe(1);
  });

  it("finds a customer by a partial email match", async () => {
    const { user } = await registerAndLogin();

    const fragment = user.email.split("@")[0].slice(-8);

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: fragment })
      .set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.customers.some((c) => c.id === user.id)).toBe(true);
  });

  it("finds a customer by company name", async () => {
    const companyName = `SearchableCo${Date.now()}`;
    const { user } = await registerAndLogin({ company_name: companyName });

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: companyName })
      .set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(1);
    expect(res.body.customers[0].id).toBe(user.id);
  });

  it("returns an empty list (not an error) when nothing matches", async () => {

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: `no-such-customer-${Date.now()}` })
      .set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it("treats a blank/whitespace-only search as no search at all", async () => {
    await registerAndLogin();

    const unsearched = await request(app)
      .get("/api/admin/customers")
      .set(authed(admin.token));

    const blank = await request(app)
      .get("/api/admin/customers")
      .query({ search: "   " })
      .set(authed(admin.token));

    expect(blank.status).toBe(200);
    expect(blank.body.pagination.total).toBe(unsearched.body.pagination.total);
  });

  it("keeps the paginated total in sync with the filtered rows", async () => {
    const companyName = `PagedCo${Date.now()}`;
    await registerAndLogin({ company_name: companyName });
    await registerAndLogin({ company_name: companyName });

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: companyName })
      .set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.customers).toHaveLength(2);
  });

  it("does not let a search term break out of the query (SQL injection)", async () => {
    await registerAndLogin();

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: "' OR '1'='1" })
      .set(authed(admin.token));

    // Treated as a literal string to match on, so it finds nothing —
    // it must NOT return every customer.
    expect(res.status).toBe(200);
    expect(res.body.customers).toHaveLength(0);
  });

  it("still requires admin access", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/admin/customers")
      .query({ search: "anything" })
      .set(authed(token));

    expect(res.status).toBe(403);
  });
});
