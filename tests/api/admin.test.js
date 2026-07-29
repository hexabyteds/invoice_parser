const { request, app, registerAndLogin, loginAsAdmin, authed } = require("../helpers/api");

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
      .post("/api/clients")
      .set(authed(userToken))
      .send({ company_name: "Visible To Admin Co" });

    const { token: adminToken } = await loginAsAdmin();

    const list = await request(app)
      .get("/api/admin/customers")
      .set(authed(adminToken));

    expect(list.status).toBe(200);
    const customerId = created.body.client.user_id;

    const details = await request(app)
      .get(`/api/admin/customers/${customerId}`)
      .set(authed(adminToken));

    expect(details.status).toBe(200);
    expect(
      details.body.clients.some((c) => c.company_name === "Visible To Admin Co")
    ).toBe(true);
  });
});
