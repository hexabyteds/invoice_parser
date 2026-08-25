const jwt = require("jsonwebtoken");
const pool = require("../../config/database");
const { request, app, registerAndLogin, authed } = require("../helpers/api");

describe("Security — SQL injection", () => {
  it("does not let a login payload bypass auth via SQL injection", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "' OR '1'='1' -- ",
      password: "' OR '1'='1",
    });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("stores an SQL-injection payload as an inert string, not a live query", async () => {
    const { token } = await registerAndLogin();
    const payload = "Robert'); DROP TABLE customers; --";

    const created = await request(app)
      .post("/api/customers")
      .set(authed(token))
      .send({ company_name: payload });

    expect(created.status).toBe(201);
    expect(created.body.customer.company_name).toBe(payload);

    // Table must still exist and be queryable.
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM customers`
    );
    expect(rows[0].total).toBeGreaterThan(0);
  });
});

describe("Security — XSS payload handling", () => {
  it("round-trips an XSS payload unmodified via the API (documents that sanitization/escaping is the frontend's responsibility)", async () => {
    const { token } = await registerAndLogin();
    const payload = "<script>alert('xss')</script>";

    const created = await request(app)
      .post("/api/customers")
      .set(authed(token))
      .send({ company_name: payload, notes: payload });

    expect(created.status).toBe(201);
    expect(created.body.customer.company_name).toBe(payload);
    expect(created.body.customer.notes).toBe(payload);
  });
});

describe("Security — JWT validation across protected routes", () => {
  const protectedRequests = () => [
    request(app).get("/api/auth/me"),
    request(app).get("/api/customers"),
    request(app).get("/api/invoices"),
    request(app).get("/api/admin/customers"),
  ];

  it("rejects requests with no token", async () => {
    for (const req of protectedRequests()) {
      const res = await req;
      expect(res.status).toBe(401);
    }
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = jwt.sign(
      { id: 1, email: "attacker@example.test", role: "admin" },
      "not-the-real-secret"
    );

    const res = await request(app)
      .get("/api/customers")
      .set(authed(forged));

    expect(res.status).toBe(401);
  });

  it("rejects a syntactically invalid token", async () => {
    const res = await request(app)
      .get("/api/customers")
      .set(authed("this-is-not-a-jwt"));

    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign(
      { id: 1, email: "x@x.test", role: "customer" },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );

    const res = await request(app)
      .get("/api/customers")
      .set(authed(expired));

    expect(res.status).toBe(401);
  });
});

describe("Security — POST /api/clear requires authentication", () => {
  it("rejects an unauthenticated request with a clean 401", async () => {
    const res = await request(app).post("/api/clear");

    expect(res.status).toBe(401);
  });
});
