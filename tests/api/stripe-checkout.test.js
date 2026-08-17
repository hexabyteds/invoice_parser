// The whole `stripe` SDK is mocked so these tests never make a real network
// call — `config/stripe.js` does `new Stripe(...)`, and this factory makes
// that call return one shared, spy-able instance for the whole test file.
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

function fakeStripeSubscription(overrides = {}) {
  return {
    id: "sub_test_123",
    customer: "cus_test_123",
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

describe("POST /api/subscriptions/checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .send({ planId: 1, interval: "monthly" });

    expect(res.status).toBe(401);
  });

  it("rejects an invalid plan", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: 999999, interval: "monthly" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects an invalid billing interval", async () => {
    const { token } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "weekly" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid billing interval/i);
  });

  it("creates a new Stripe customer and a monthly checkout session for a first-time subscriber", async () => {
    const { token } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_new_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_abc",
    });

    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.com/session_abc");

    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_new_1",
        line_items: [{ price: "price_test_starter_monthly", quantity: 1 }],
      })
    );
  });

  it("creates a yearly checkout session using the plan's yearly price id", async () => {
    const { token } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_new_2" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_yearly",
    });

    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "yearly" });

    expect(res.status).toBe(200);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_test_starter_yearly", quantity: 1 }],
      })
    );
  });

  it("reuses an existing Stripe customer instead of creating a duplicate", async () => {
    const { token } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_reuse_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_first",
    });

    // First checkout attempt creates the customer.
    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);

    // A second attempt (e.g. user abandoned the first checkout and retries)
    // must reuse the same Stripe customer, not create another one.
    stripeMock.customers.retrieve.mockResolvedValue({
      id: "cus_reuse_1",
      deleted: false,
    });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_second",
    });

    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.customers.retrieve).toHaveBeenCalledWith("cus_reuse_1");
  });

  it("updates the existing Stripe subscription instead of starting a second checkout for an active subscriber", async () => {
    const { token } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");
    const business = await getPlanBySlug("business");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_upgrade_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_initial",
    });

    // Subscribe to Starter first, then activate it via the webhook sync
    // path (checkout.session.completed equivalent) so a live Stripe
    // subscription exists locally.
    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_upgrade_1",
        customer: "cus_upgrade_1",
        items: {
          data: [
            {
              price: { id: "price_test_starter_monthly" },
              current_period_end:
                Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          ],
        },
      })
    );

    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      data: {
        object: { mode: "subscription", subscription: "sub_upgrade_1" },
      },
    });

    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "valid_test_signature")
      .send(Buffer.from("{}"));

    // Now upgrade to Business — should update the existing Stripe
    // subscription in place, not call checkout.sessions.create again.
    stripeMock.subscriptions.update.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_upgrade_1",
        customer: "cus_upgrade_1",
        items: {
          data: [
            {
              price: { id: "price_test_business_monthly" },
              current_period_end:
                Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
          ],
        },
      })
    );
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: "si_1", price: { id: "price_test_starter_monthly" } }] },
    });

    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: business.id, interval: "monthly" });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1); // still just the initial one
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_upgrade_1",
      expect.objectContaining({
        items: [{ id: "si_1", price: "price_test_business_monthly" }],
      })
    );

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    expect(current.body.subscription.plan_id).toBe(business.id);
    // Same underlying Stripe subscription id — updated in place, not a
    // second local row.
    expect(current.body.subscription.stripe_subscription_id).toBe(
      "sub_upgrade_1"
    );
  });
});

describe("POST /api/subscriptions/cancel (Stripe-backed subscription)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defers to Stripe cancel_at_period_end and keeps access instead of dropping to Free immediately", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_cancel_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_cancel",
    });

    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_cancel_1",
        customer: "cus_cancel_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_cancel_activate_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_cancel_1" } },
    });
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "valid_test_signature")
      .send(Buffer.from("{}"));

    // A realistic full subscription object — cancelSubscription now syncs
    // from Stripe's actual update() response (see BUG-BILLING-001) rather
    // than assuming its own requested value was applied, so the mock has
    // to look like a real Stripe subscription, not just {id, cancel_at_period_end}.
    stripeMock.subscriptions.update.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_cancel_1",
        customer: "cus_cancel_1",
        cancel_at_period_end: true,
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );

    const res = await request(app)
      .post("/api/subscriptions/cancel")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_cancel_1",
      { cancel_at_period_end: true }
    );

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    // Still active and still on Starter — access retained until Stripe
    // confirms the period actually ended (via a later webhook).
    expect(current.body.subscription.status).toBe("active");
    expect(current.body.subscription.plan_id).toBe(starter.id);
    expect(Number(current.body.subscription.cancel_at_period_end)).toBe(1);
  });

  it("writes what Stripe's response actually says, not the value we asked for — closes the concurrent cancel+resume race (BUG-BILLING-001)", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_race_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_race",
    });

    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_race_1",
        customer: "cus_race_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_race_activate_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_race_1" } },
    });
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "valid_test_signature")
      .send(Buffer.from("{}"));

    // Simulates the exact race: this request asked Stripe to cancel, but
    // by the time Stripe's response comes back, a concurrent resume has
    // already won on Stripe's side — Stripe's own response reflects that
    // (cancel_at_period_end: false), even though this call's *intent* was
    // true. The old code ignored the response and blindly wrote its own
    // intended value (true); the fix must write what Stripe actually said.
    stripeMock.subscriptions.update.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_race_1",
        customer: "cus_race_1",
        cancel_at_period_end: false,
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );

    const res = await request(app)
      .post("/api/subscriptions/cancel")
      .set(authed(token));

    expect(res.status).toBe(200);

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    // Must reflect Stripe's actual answer (false), not the true we asked for.
    expect(Number(current.body.subscription.cancel_at_period_end)).toBe(0);
  });
});

describe("POST /api/subscriptions/renew (Resume Plan — Stripe-backed subscription)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/subscriptions/renew");
    expect(res.status).toBe(401);
  });

  it("clears cancel_at_period_end on Stripe and keeps the paid plan active", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_resume_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_resume",
    });

    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_resume_1",
        customer: "cus_resume_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_resume_activate_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_resume_1" } },
    });
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "valid_test_signature")
      .send(Buffer.from("{}"));

    // Schedule cancellation first, same as a real "Cancel Plan" click. Full
    // subscription objects, not just {id, cancel_at_period_end} — see the
    // cancel test above for why (BUG-BILLING-001).
    stripeMock.subscriptions.update.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_resume_1",
        customer: "cus_resume_1",
        cancel_at_period_end: true,
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    await request(app).post("/api/subscriptions/cancel").set(authed(token));

    let current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));
    expect(Number(current.body.subscription.cancel_at_period_end)).toBe(1);

    // Now resume before the period ends.
    stripeMock.subscriptions.update.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_resume_1",
        customer: "cus_resume_1",
        cancel_at_period_end: false,
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );

    const res = await request(app)
      .post("/api/subscriptions/renew")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(stripeMock.subscriptions.update).toHaveBeenLastCalledWith(
      "sub_resume_1",
      { cancel_at_period_end: false }
    );

    current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    // Still active, still on Starter, and no longer flagged for cancellation.
    expect(current.body.subscription.status).toBe("active");
    expect(current.body.subscription.plan_id).toBe(starter.id);
    expect(Number(current.body.subscription.cancel_at_period_end)).toBe(0);
  });
});

describe("Stripe API failures leave local subscription state unchanged", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not set cancel_at_period_end locally when Stripe's cancel call fails", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_cancelfail_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_cancelfail",
    });
    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_cancelfail_1",
        customer: "cus_cancelfail_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_cancelfail_activate_1",
      type: "checkout.session.completed",
      data: {
        object: { mode: "subscription", subscription: "sub_cancelfail_1" },
      },
    });
    await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "valid_test_signature")
      .send(Buffer.from("{}"));

    stripeMock.subscriptions.update.mockImplementation(() => {
      const err = new Error("Your card was declined.");
      err.type = "StripeInvalidRequestError";
      throw err;
    });

    const res = await request(app)
      .post("/api/subscriptions/cancel")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    // Untouched — still active, on the paid plan, not flagged for cancellation.
    expect(current.body.subscription.status).toBe("active");
    expect(current.body.subscription.plan_id).toBe(starter.id);
    expect(Number(current.body.subscription.cancel_at_period_end)).toBe(0);
  });
});

describe("POST /api/subscriptions/portal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/subscriptions/portal");
    expect(res.status).toBe(401);
  });

  it("returns a clean error when the user has never subscribed to a paid plan", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post("/api/subscriptions/portal")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns a portal URL for a user with a Stripe customer", async () => {
    const { token } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.customers.create.mockResolvedValue({ id: "cus_portal_1" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_portal",
    });

    await request(app)
      .post("/api/subscriptions/checkout")
      .set(authed(token))
      .send({ planId: starter.id, interval: "monthly" });

    stripeMock.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/session_portal_1",
    });

    const res = await request(app)
      .post("/api/subscriptions/portal")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://billing.stripe.com/session_portal_1");
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_portal_1" })
    );
  });
});
