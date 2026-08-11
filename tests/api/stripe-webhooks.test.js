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

function postWebhook(signature = "valid_test_signature") {
  return request(app)
    .post("/api/stripe/webhook")
    .set("stripe-signature", signature)
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ raw: "payload does not matter, constructEvent is mocked" }));
}

function fakeStripeSubscription(overrides = {}) {
  return {
    id: "sub_evt_1",
    customer: "cus_evt_1",
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

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a request with an invalid signature", async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("signature mismatch");
    });

    const res = await postWebhook("bad_signature");

    expect(res.status).toBe(400);
  });

  it("activates the plan and stores the Stripe subscription id on checkout.session.completed", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_checkout_1",
        customer: "cus_checkout_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );

    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_checkout_complete_1",
      type: "checkout.session.completed",
      data: {
        object: { mode: "subscription", subscription: "sub_checkout_1" },
      },
    });

    const res = await postWebhook();

    expect(res.status).toBe(200);

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    expect(current.body.subscription.plan_id).toBe(starter.id);
    expect(current.body.subscription.stripe_subscription_id).toBe(
      "sub_checkout_1"
    );
    expect(current.body.subscription.stripe_status).toBe("active");
  });

  it("does not reprocess a duplicate delivery of the same event id", async () => {
    const { user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_dup_1",
        customer: "cus_dup_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );

    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_dup_1",
      type: "checkout.session.completed",
      data: {
        object: { mode: "subscription", subscription: "sub_dup_1" },
      },
    });

    const first = await postWebhook();
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeUndefined();

    const second = await postWebhook();
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    // The event was only actually handled once.
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(1);
  });

  it("updates the same local row (not a second one) on customer.subscription.updated for an already-known subscription", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");
    const business = await getPlanBySlug("business");

    // First: create the subscription locally via checkout.session.completed.
    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_update_1",
        customer: "cus_update_1",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_update_create_1",
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub_update_1" } },
    });
    await postWebhook();

    // Then: a plan-change on the SAME Stripe subscription id.
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_update_change_1",
      type: "customer.subscription.updated",
      data: {
        object: fakeStripeSubscription({
          id: "sub_update_1",
          customer: "cus_update_1",
          metadata: { userId: String(user.id), planId: String(business.id) },
          items: {
            data: [
              {
                price: { id: "price_test_business_monthly" },
                current_period_end:
                  Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              },
            ],
          },
        }),
      },
    });
    const res = await postWebhook();
    expect(res.status).toBe(200);

    const history = await request(app)
      .get("/api/subscriptions/history")
      .set(authed(token));

    const rowsForThisSub = history.body.history.filter(
      (row) => row.stripe_subscription_id === "sub_update_1"
    );

    expect(rowsForThisSub.length).toBe(1);
    expect(rowsForThisSub[0].plan_id).toBe(business.id);

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));
    expect(current.body.subscription.plan_id).toBe(business.id);
  });

  it("drops the user back to Free on customer.subscription.deleted", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_create_for_delete_1",
      type: "customer.subscription.created",
      data: {
        object: fakeStripeSubscription({
          id: "sub_delete_1",
          customer: "cus_delete_1",
          metadata: { userId: String(user.id), planId: String(starter.id) },
        }),
      },
    });
    await postWebhook();

    let current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));
    expect(current.body.subscription.plan_id).toBe(starter.id);

    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_deleted_1",
      type: "customer.subscription.deleted",
      data: {
        object: fakeStripeSubscription({
          id: "sub_delete_1",
          customer: "cus_delete_1",
          status: "canceled",
          metadata: { userId: String(user.id), planId: String(starter.id) },
        }),
      },
    });
    const res = await postWebhook();
    expect(res.status).toBe(200);

    current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));
    expect(current.body.subscription.slug).toBe("free");
  });

  it("keeps access (local status stays active) but records past_due on invoice.payment_failed", async () => {
    const { token, user } = await registerAndLogin();
    const starter = await getPlanBySlug("starter");

    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_create_for_pastdue_1",
      type: "customer.subscription.created",
      data: {
        object: fakeStripeSubscription({
          id: "sub_pastdue_1",
          customer: "cus_pastdue_1",
          metadata: { userId: String(user.id), planId: String(starter.id) },
        }),
      },
    });
    await postWebhook();

    stripeMock.subscriptions.retrieve.mockResolvedValue(
      fakeStripeSubscription({
        id: "sub_pastdue_1",
        customer: "cus_pastdue_1",
        status: "past_due",
        metadata: { userId: String(user.id), planId: String(starter.id) },
      })
    );
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_payment_failed_1",
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_pastdue_1" } },
    });
    const res = await postWebhook();
    expect(res.status).toBe(200);

    const current = await request(app)
      .get("/api/subscriptions/current")
      .set(authed(token));

    // Access preserved (grace period)...
    expect(current.body.subscription.status).toBe("active");
    expect(current.body.subscription.plan_id).toBe(starter.id);
    // ...but the raw Stripe status is visible for anything that needs it.
    expect(current.body.subscription.stripe_status).toBe("past_due");
  });
});
