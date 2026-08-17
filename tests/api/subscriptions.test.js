const { request, app, registerAndLogin, loginAsAdmin, authed } = require("../helpers/api");

async function getPlanBySlug(slug) {
  const res = await request(app).get("/api/plans");
  return res.body.plans.find((p) => p.slug === slug);
}

describe("Customer self-service subscription management", () => {
  describe("POST /api/subscriptions/select-plan", () => {
    it("requires authentication", async () => {
      const res = await request(app).post("/api/subscriptions/select-plan").send({});

      expect(res.status).toBe(401);
    });

    it("rejects selecting a paid plan directly — paid plans must go through Stripe checkout", async () => {
      const { token } = await registerAndLogin();
      const starter = await getPlanBySlug("starter");

      const res = await request(app)
        .post("/api/subscriptions/select-plan")
        .set(authed(token))
        .send({ planId: starter.id, billingCycle: "monthly" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/checkout/i);

      // Confirm nothing changed — still on Free.
      const current = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(token));

      expect(current.body.subscription.slug).toBe("free");
    });

    it("cannot be used to change another user's plan (userId is never trusted from the body)", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const starter = await getPlanBySlug("starter");
      const free = await getPlanBySlug("free");
      const admin = await loginAsAdmin();

      // Put B on a paid plan via the admin-only endpoint (the one place
      // that legitimately takes an arbitrary target userId).
      await request(app)
        .post("/api/subscriptions/change-plan")
        .set(authed(admin.token))
        .send({ userId: userB.user.id, planId: starter.id, billingCycle: "monthly" });

      // A (still on Free) tries to move "userId: B" to Free via the
      // customer self-service endpoint. If it incorrectly trusted the
      // body's userId, this would downgrade B; instead it must only ever
      // act on A's own subscription, which is already Free — so the
      // "already on this plan" guard fires for A.
      const res = await request(app)
        .post("/api/subscriptions/select-plan")
        .set(authed(userA.token))
        .send({ userId: userB.user.id, planId: free.id });

      expect(res.status).toBe(400);

      const currentB = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(userB.token));

      // B is untouched — still on Starter.
      expect(currentB.body.subscription.plan_id).toBe(starter.id);
    });

    it("rejects re-selecting the plan the customer is already on", async () => {
      const { token } = await registerAndLogin();
      const free = await getPlanBySlug("free");

      const res = await request(app)
        .post("/api/subscriptions/select-plan")
        .set(authed(token))
        .send({ planId: free.id });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/subscriptions/cancel", () => {
    it("requires authentication", async () => {
      const res = await request(app).post("/api/subscriptions/cancel");
      expect(res.status).toBe(401);
    });

    it("can only ever cancel the caller's own subscription — the endpoint takes no target userId", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const starter = await getPlanBySlug("starter");
      const admin = await loginAsAdmin();

      // Put B on a paid plan.
      await request(app)
        .post("/api/subscriptions/change-plan")
        .set(authed(admin.token))
        .send({ userId: userB.user.id, planId: starter.id, billingCycle: "monthly" });

      // A cancels their own (Free) subscription — there is no request field
      // that could redirect this at B's subscription instead.
      await request(app).post("/api/subscriptions/cancel").set(authed(userA.token));

      const currentB = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(userB.token));

      // B is untouched — still on Starter.
      expect(currentB.body.subscription.plan_id).toBe(starter.id);
    });

    it("drops a paid (non-Stripe, admin-assigned) plan straight back to Free", async () => {
      const { token, user } = await registerAndLogin();
      const starter = await getPlanBySlug("starter");
      const admin = await loginAsAdmin();

      // No stripe_subscription_id on this row (admin-comped), so cancel
      // should take the immediate-downgrade path rather than deferring to
      // a Stripe period end — see the mocked-Stripe cancel test in
      // stripe-checkout.test.js for the Stripe-backed case.
      await request(app)
        .post("/api/subscriptions/change-plan")
        .set(authed(admin.token))
        .send({ userId: user.id, planId: starter.id, billingCycle: "monthly" });

      const res = await request(app)
        .post("/api/subscriptions/cancel")
        .set(authed(token));

      expect(res.status).toBe(200);

      const current = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(token));

      expect(current.body.subscription.slug).toBe("free");
    });
  });
});
