jest.mock("stripe", () => {
  const mockInstance = {
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    invoices: {
      list: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  function StripeMock() {
    return mockInstance;
  }
  StripeMock.API_VERSION = "test-api-version";

  return StripeMock;
});

const { request, app, registerAndLogin, authed } = require("../helpers/api");
const stripeMock = require("../../config/stripe");

async function getPlanBySlug(slug) {
  const res = await request(app).get("/api/plans");
  return res.body.plans.find((p) => p.slug === slug);
}

function fakeStripeSubscription(seed, overrides = {}) {
  return {
    id: `sub_bill_${seed}`,
    customer: `cus_bill_${seed}`,
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

function fakeInvoice(seed, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `in_test_${seed}`,
    number: `INV-${seed}`,
    customer: `cus_bill_${seed}`,
    status: "paid",
    created: now,
    amount_paid: 2000,
    total: 2000,
    subtotal: 2000,
    tax: 0,
    currency: "aed",
    invoice_pdf: `https://pay.stripe.com/invoice/in_test_${seed}/pdf`,
    hosted_invoice_url: `https://pay.stripe.com/invoice/in_test_${seed}`,
    charge: { refunded: false },
    lines: {
      data: [
        {
          price: { id: "price_test_starter_monthly" },
          period: { start: now, end: now + 30 * 24 * 60 * 60 },
        },
      ],
    },
    ...overrides,
  };
}

// Every call site uses its own `seed` so the Stripe ids it fabricates
// (cus_bill_<seed>, sub_bill_<seed>) never collide with another test's —
// both stripe_customer_id and stripe_subscription_id are UNIQUE columns
// in the real (non-mocked) test database this suite runs against.
async function subscribeAndActivate(token, user, planId, seed) {
  stripeMock.customers.create.mockResolvedValue({ id: `cus_bill_${seed}` });
  stripeMock.checkout.sessions.create.mockResolvedValue({
    url: `https://checkout.stripe.com/session_${seed}`,
  });

  const checkoutRes = await request(app)
    .post("/api/subscriptions/checkout")
    .set(authed(token))
    .send({ planId, interval: "monthly" });

  if (checkoutRes.status !== 200) {
    throw new Error(
      `subscribeAndActivate: checkout failed: ${JSON.stringify(checkoutRes.body)}`
    );
  }

  stripeMock.subscriptions.retrieve.mockResolvedValue(
    fakeStripeSubscription(seed, {
      metadata: { userId: String(user.id), planId: String(planId) },
    })
  );
  stripeMock.webhooks.constructEvent.mockReturnValue({
    id: `evt_bill_activate_${seed}`,
    type: "checkout.session.completed",
    data: {
      object: { mode: "subscription", subscription: `sub_bill_${seed}` },
    },
  });

  const webhookRes = await request(app)
    .post("/api/stripe/webhook")
    .set("stripe-signature", "valid_test_signature")
    .send(Buffer.from("{}"));

  if (webhookRes.status !== 200) {
    throw new Error(
      `subscribeAndActivate: webhook failed: ${JSON.stringify(webhookRes.body)}`
    );
  }
}

describe("GET /api/subscriptions/payments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/subscriptions/payments");
    expect(res.status).toBe(401);
  });

  it("returns an empty list for a user who has never had a Stripe customer (Free plan)", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/subscriptions/payments")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.payments).toEqual([]);
    expect(res.body.hasMore).toBe(false);
    expect(stripeMock.invoices.list).not.toHaveBeenCalled();
  });

  it("lists the authenticated user's invoices, mapped to the local plan and formatted amount/currency", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    await subscribeAndActivate(token, user, starter.id, "list1");

    stripeMock.invoices.list.mockResolvedValue({
      data: [fakeInvoice("list1")],
      has_more: false,
    });

    const res = await request(app)
      .get("/api/subscriptions/payments")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(stripeMock.invoices.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_bill_list1" })
    );

    expect(res.body.payments).toHaveLength(1);
    const payment = res.body.payments[0];
    expect(payment.plan).toBe("Starter");
    expect(payment.amount).toBe(20); // 2000 fils -> 20.00
    expect(payment.currency).toBe("AED");
    expect(payment.status).toBe("paid");
    expect(payment.invoicePdf).toBe(
      "https://pay.stripe.com/invoice/in_test_list1/pdf"
    );
  });

  it("maps Stripe's own invoice statuses (open -> pending, void -> failed)", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    await subscribeAndActivate(token, user, starter.id, "status1");

    stripeMock.invoices.list.mockResolvedValue({
      data: [fakeInvoice("status1", { status: "open" })],
      has_more: false,
    });

    let res = await request(app)
      .get("/api/subscriptions/payments")
      .set(authed(token));
    expect(res.body.payments[0].status).toBe("pending");

    stripeMock.invoices.list.mockResolvedValue({
      data: [fakeInvoice("status1", { status: "void" })],
      has_more: false,
    });

    res = await request(app)
      .get("/api/subscriptions/payments")
      .set(authed(token));
    expect(res.body.payments[0].status).toBe("failed");
  });

  it("resolves the plan name from the newer `pricing.price_details.price` line-item shape, not just the older `price.id` one", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    await subscribeAndActivate(token, user, starter.id, "newshape1");

    const now = Math.floor(Date.now() / 1000);
    stripeMock.invoices.list.mockResolvedValue({
      data: [
        fakeInvoice("newshape1", {
          lines: {
            data: [
              {
                // No `.price` field at all — only the newer nested shape,
                // matching what this Stripe account's pinned API version
                // actually returns.
                pricing: {
                  price_details: { price: "price_test_starter_monthly" },
                },
                period: { start: now, end: now + 30 * 24 * 60 * 60 },
              },
            ],
          },
        }),
      ],
      has_more: false,
    });

    const res = await request(app)
      .get("/api/subscriptions/payments")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.payments[0].plan).toBe("Starter");
  });
});

describe("GET /api/subscriptions/payments/:invoiceId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/subscriptions/payments/in_test_1");
    expect(res.status).toBe(401);
  });

  it("returns full invoice detail including tax/subtotal/total for the owning user", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    await subscribeAndActivate(token, user, starter.id, "detail1");

    stripeMock.invoices.retrieve.mockResolvedValue(
      fakeInvoice("detail1", { subtotal: 2000, tax: 100, total: 2100 })
    );

    const res = await request(app)
      .get("/api/subscriptions/payments/in_test_detail1")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(stripeMock.invoices.retrieve).toHaveBeenCalledWith(
      "in_test_detail1",
      expect.objectContaining({ expand: expect.any(Array) })
    );
    expect(res.body.invoice.customerEmail).toBe(user.email);
    expect(res.body.invoice.subtotal).toBe(20);
    expect(res.body.invoice.tax).toBe(1);
    expect(res.body.invoice.total).toBe(21);
    expect(res.body.invoice.stripeInvoiceId).toBe("in_test_detail1");
  });

  it("blocks a user from fetching another user's invoice (IDOR)", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    // A subscribes and has a Stripe customer / invoice.
    await subscribeAndActivate(userA.token, userA.user, starter.id, "idor1");

    // B tries to fetch A's invoice id directly — even though B has no
    // Stripe customer of their own, ownership must be enforced against
    // the invoice's real `customer` field, not just "does this id exist".
    stripeMock.invoices.retrieve.mockResolvedValue(
      fakeInvoice("idor1") // customer: cus_bill_idor1, belongs to A
    );

    const res = await request(app)
      .get("/api/subscriptions/payments/in_test_idor1")
      .set(authed(userB.token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
