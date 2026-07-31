const { request, app, registerAndLogin, authed } = require("../helpers/api");

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

    it("lets a customer move themselves from Free to Starter", async () => {
      const { token } = await registerAndLogin();
      const starter = await getPlanBySlug("starter");

      const res = await request(app)
        .post("/api/subscriptions/select-plan")
        .set(authed(token))
        .send({ planId: starter.id, billingCycle: "monthly" });

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan_id).toBe(starter.id);

      const current = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(token));

      expect(current.body.subscription.plan_id).toBe(starter.id);
    });

    it("cannot be used to change another user's plan (userId is never trusted from the body)", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const starter = await getPlanBySlug("starter");

      await request(app)
        .post("/api/subscriptions/select-plan")
        .set(authed(userA.token))
        .send({ userId: userB.user.id, planId: starter.id });

      const currentB = await request(app)
        .get("/api/subscriptions/current")
        .set(authed(userB.token));

      // B is still on Free — A's request only ever touched A's own subscription.
      expect(currentB.body.subscription.plan_id).not.toBe(starter.id);
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
    it("drops a paid plan back to Free", async () => {
      const { token } = await registerAndLogin();
      const starter = await getPlanBySlug("starter");

      await request(app)
        .post("/api/subscriptions/select-plan")
        .set(authed(token))
        .send({ planId: starter.id });

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
