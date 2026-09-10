jest.mock("stripe", () => {
  const mockInstance = {
    customers: { create: jest.fn(), retrieve: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    subscriptions: { retrieve: jest.fn(), update: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  };

  function StripeMock() {
    return mockInstance;
  }
  StripeMock.API_VERSION = "test-api-version";

  return StripeMock;
});

jest.mock("../../services/invoiceService");

const pool = require("../../config/database");
const { request, app, registerAndLogin, authed } = require("../helpers/api");
const stripeMock = require("../../config/stripe");
const invoiceService = require("../../services/invoiceService");
const { mockSuccessfulExtract } = require("../mocks/invoiceService.mock");
const { samplePngBuffer } = require("../helpers/fixtures");

async function ownedCompanyId(userId) {
  const [[row]] = await pool.execute(
    `SELECT id FROM companies WHERE owner_user_id = ? LIMIT 1`,
    [userId]
  );
  return row.id;
}

async function createClient(token, name = "Trial Test Client") {
  const res = await request(app)
    .post("/api/customers")
    .set(authed(token))
    .send({ company_name: name });
  return res;
}

// Directly backdates the caller's own subscription row past its trial —
// simulates "7 days have passed" without waiting, same direct-DB-access
// style already used elsewhere in this suite (tests/setup/globalSetup.js,
// invoices.test.js's concurrency tests).
async function expireTrial(userId) {
  await pool.execute(
    `UPDATE subscriptions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE user_id = ? AND status = 'trial'`,
    [userId]
  );
}

async function getPlanBySlug(slug) {
  const res = await request(app).get("/api/plans");
  return res.body.plans.find((p) => p.slug === slug);
}

function postWebhook() {
  return request(app)
    .post("/api/stripe/webhook")
    .set("stripe-signature", "valid_test_signature")
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ raw: "payload does not matter, constructEvent is mocked" }));
}

function fakeStripeSubscription(overrides = {}) {
  return {
    id: "sub_trial_evt_1",
    customer: "cus_trial_evt_1",
    status: "active",
    cancel_at_period_end: false,
    start_date: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      data: [
        {
          price: { id: "price_test_starter_monthly" },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      ],
    },
    metadata: {},
    ...overrides,
  };
}

describe("7-day trial", () => {
  describe("New registration", () => {
    it("gets a 7-day trial starting from the server timestamp, not client input", async () => {
      const before = Date.now();
      const { token } = await registerAndLogin();
      const after = Date.now();

      const res = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(token));

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe("trial");
      expect(res.body.subscription.slug).toBe("free");
      expect(res.body.subscription.trial.isTrialing).toBe(true);
      expect(res.body.subscription.trial.isExpired).toBe(false);
      expect(res.body.subscription.trial.daysRemaining).toBe(7);

      const startsAt = new Date(res.body.subscription.starts_at).getTime();
      const expiresAt = new Date(res.body.subscription.expires_at).getTime();

      // starts_at is server time, not anything the client sent.
      expect(startsAt).toBeGreaterThanOrEqual(before - 5000);
      expect(startsAt).toBeLessThanOrEqual(after + 5000);

      // Exactly 7 days later, within a few seconds of tolerance.
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiresAt - startsAt - sevenDaysMs)).toBeLessThan(5000);
    });

    it("surfaces the trial on /auth/me too, with no extra client fetch", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app).get("/api/auth/me").set(authed(token));

      expect(res.status).toBe(200);
      expect(res.body.user.subscription.status).toBe("trial");
      expect(res.body.user.subscription.trial.isTrialing).toBe(true);
      expect(res.body.user.subscription.trial.daysRemaining).toBe(7);
    });
  });

  describe("Within the trial window", () => {
    it("can create a customer, a supplier, and upload a document", async () => {
      const { token } = await registerAndLogin();

      const customerRes = await createClient(token);
      expect(customerRes.status).toBe(201);

      const supplierRes = await request(app)
        .post("/api/suppliers")
        .set(authed(token))
        .send({
          company_name: "Trial Supplier",
          email: "vendor@example.test",
          phone: "1234567890",
          billing_country: "AE",
          billing_city: "Dubai",
          trn: "100000000000000",
        });
      expect(supplierRes.status).toBe(201);

      mockSuccessfulExtract(invoiceService);
      const uploadRes = await request(app)
        .post("/api/upload")
        .set(authed(token))
        .field("client_id", String(customerRes.body.customer.id))
        .attach("image", samplePngBuffer(), "invoice.png");

      expect(uploadRes.status).not.toBe(403);
    });
  });

  describe("Once the trial has expired", () => {
    async function setupExpiredTrial() {
      const { token, user } = await registerAndLogin();
      const clientRes = await createClient(token);
      const customerId = clientRes.body.customer.id;
      await expireTrial(user.id);
      return { token, user, customerId };
    }

    it("still allows login and reading /auth/me", async () => {
      const { token } = await setupExpiredTrial();

      const me = await request(app).get("/api/auth/me").set(authed(token));

      expect(me.status).toBe(200);
      expect(me.body.user.subscription.status).toBe("trial");
      expect(me.body.user.subscription.trial.isExpired).toBe(true);
    });

    it("still allows viewing existing customers, suppliers, and companies", async () => {
      const { token } = await setupExpiredTrial();

      const customers = await request(app).get("/api/customers").set(authed(token));
      expect(customers.status).toBe(200);

      const suppliers = await request(app).get("/api/suppliers").set(authed(token));
      expect(suppliers.status).toBe(200);

      const current = await request(app).get("/api/companies/current").set(authed(token));
      expect(current.status).toBe(200);
    });

    it("blocks creating a customer with 403 TRIAL_EXPIRED", async () => {
      const { token } = await setupExpiredTrial();

      const res = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .send({ company_name: "Should Be Blocked" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TRIAL_EXPIRED");
    });

    it("blocks editing and deleting an existing customer", async () => {
      const { token, customerId } = await setupExpiredTrial();

      const edit = await request(app)
        .put(`/api/customers/${customerId}`)
        .set(authed(token))
        .send({ company_name: "Renamed" });
      expect(edit.status).toBe(403);
      expect(edit.body.code).toBe("TRIAL_EXPIRED");

      const del = await request(app)
        .delete(`/api/customers/${customerId}`)
        .set(authed(token));
      expect(del.status).toBe(403);
      expect(del.body.code).toBe("TRIAL_EXPIRED");
    });

    it("blocks creating a supplier", async () => {
      const { token } = await setupExpiredTrial();

      const res = await request(app)
        .post("/api/suppliers")
        .set(authed(token))
        .send({ company_name: "Should Be Blocked" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TRIAL_EXPIRED");
    });

    it("blocks uploading a document", async () => {
      const { token, customerId } = await setupExpiredTrial();

      mockSuccessfulExtract(invoiceService);
      const res = await request(app)
        .post("/api/upload")
        .set(authed(token))
        .field("client_id", String(customerId))
        .attach("image", samplePngBuffer(), "invoice.png");

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TRIAL_EXPIRED");
    });

    it("blocks a Freelancer from creating another company", async () => {
      const { token, user } = await registerAndLogin({ account_type: "FREELANCER" });
      // Freelancer's account-level subscription is created lazily on
      // first write — force it into existence, then expire it.
      await request(app).post("/api/companies").set(authed(token)).send({ name: "First Co" });
      await expireTrial(user.id);

      const res = await request(app)
        .post("/api/companies")
        .set(authed(token))
        .send({ name: "Second Co" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("TRIAL_EXPIRED");
    });
  });

  describe("Freelancer multi-company — one trial, not one per company", () => {
    it("expiring the Freelancer's single account-level subscription blocks writes under every company they own", async () => {
      const { token, user } = await registerAndLogin({ account_type: "FREELANCER" });

      const companyA = await request(app).post("/api/companies").set(authed(token)).send({ name: "Company A" });
      const companyB = await request(app).post("/api/companies").set(authed(token)).send({ name: "Company B" });
      expect(companyA.status).toBe(201);
      expect(companyB.status).toBe(201);

      await expireTrial(user.id);

      const createInA = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .set("X-Company-Id", String(companyA.body.companyId))
        .send({ company_name: "Blocked in A" });

      const createInB = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .set("X-Company-Id", String(companyB.body.companyId))
        .send({ company_name: "Blocked in B" });

      expect(createInA.status).toBe(403);
      expect(createInA.body.code).toBe("TRIAL_EXPIRED");
      expect(createInB.status).toBe(403);
      expect(createInB.body.code).toBe("TRIAL_EXPIRED");
    });
  });

  describe("Active (paid) subscriptions are unaffected", () => {
    it("can still write even with an expires_at in the past, as long as status is active", async () => {
      const { token, user } = await registerAndLogin();

      await pool.execute(
        `UPDATE subscriptions SET status = 'active', expires_at = DATE_SUB(NOW(), INTERVAL 30 DAY) WHERE user_id = ?`,
        [user.id]
      );

      const res = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .send({ company_name: "Should Be Allowed" });

      expect(res.status).toBe(201);
    });
  });

  describe("Stripe upgrade path", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("moves a trialing account to active on checkout completion, restoring write access", async () => {
      const { token, user } = await registerAndLogin();
      const starter = await getPlanBySlug("starter");

      // Still trialing beforehand.
      const before = await request(app).get("/api/subscriptions/current").set(authed(token));
      expect(before.body.subscription.status).toBe("trial");
      const trialSubId = before.body.subscription.id;

      stripeMock.subscriptions.retrieve.mockResolvedValue(
        fakeStripeSubscription({
          metadata: { userId: String(user.id), planId: String(starter.id) },
        })
      );
      stripeMock.webhooks.constructEvent.mockReturnValue({
        id: "evt_trial_upgrade_1",
        type: "checkout.session.completed",
        data: { object: { mode: "subscription", subscription: "sub_trial_evt_1" } },
      });

      const webhookRes = await postWebhook();
      expect(webhookRes.status).toBe(200);

      const after = await request(app).get("/api/subscriptions/current").set(authed(token));
      expect(after.body.subscription.status).toBe("active");
      expect(after.body.subscription.plan_id).toBe(starter.id);
      expect(after.body.subscription.trial.isTrialing).toBe(false);

      // The old trial row is expired, not left dangling alongside the new one.
      const [[oldRow]] = await pool.execute(
        `SELECT status FROM subscriptions WHERE id = ?`,
        [trialSubId]
      );
      expect(oldRow.status).toBe("expired");

      // Write access is restored.
      const createRes = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .send({ company_name: "Now Allowed" });
      expect(createRes.status).toBe(201);
    });

    it("also restores write access when upgrading after the trial had already expired", async () => {
      const { token, user } = await registerAndLogin();
      const starter = await getPlanBySlug("starter");

      await expireTrial(user.id);

      const blocked = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .send({ company_name: "Should Be Blocked" });
      expect(blocked.status).toBe(403);

      stripeMock.subscriptions.retrieve.mockResolvedValue(
        fakeStripeSubscription({
          id: "sub_expired_upgrade_1",
          customer: "cus_expired_upgrade_1",
          metadata: { userId: String(user.id), planId: String(starter.id) },
        })
      );
      stripeMock.webhooks.constructEvent.mockReturnValue({
        id: "evt_expired_upgrade_1",
        type: "checkout.session.completed",
        data: { object: { mode: "subscription", subscription: "sub_expired_upgrade_1" } },
      });

      const webhookRes = await postWebhook();
      expect(webhookRes.status).toBe(200);

      const allowed = await request(app)
        .post("/api/customers")
        .set(authed(token))
        .send({ company_name: "Now Allowed" });
      expect(allowed.status).toBe(201);
    });
  });
});
