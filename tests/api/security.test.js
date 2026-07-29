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
    const payload = "Robert'); DROP TABLE clients; --";

    const created = await request(app)
      .post("/api/clients")
      .set(authed(token))
      .send({ company_name: payload });

    expect(created.status).toBe(201);
    expect(created.body.client.company_name).toBe(payload);

    // Table must still exist and be queryable.
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM clients`
    );
    expect(rows[0].total).toBeGreaterThan(0);
  });
});

describe("Security — XSS payload handling", () => {
  it("round-trips an XSS payload unmodified via the API (documents that sanitization/escaping is the frontend's responsibility)", async () => {
    const { token } = await registerAndLogin();
    const payload = "<script>alert('xss')</script>";

    const created = await request(app)
      .post("/api/clients")
      .set(authed(token))
      .send({ company_name: payload, notes: payload });

    expect(created.status).toBe(201);
    expect(created.body.client.company_name).toBe(payload);
    expect(created.body.client.notes).toBe(payload);
  });
});

describe("Security — JWT validation across protected routes", () => {
  const protectedRequests = () => [
    request(app).get("/api/auth/me"),
    request(app).get("/api/clients"),
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
      .get("/api/clients")
      .set(authed(forged));

    expect(res.status).toBe(401);
  });

  it("rejects a syntactically invalid token", async () => {
    const res = await request(app)
      .get("/api/clients")
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
      .get("/api/clients")
      .set(authed(expired));

    expect(res.status).toBe(401);
  });
});

describe("Security — known gap: POST /api/clear has no auth middleware", () => {
  it("current behavior: an unauthenticated request 500s instead of a clean 401 (regression trap — see QA report)", async () => {
    const res = await request(app).post("/api/clear");

    // This is NOT the desired behavior — /api/clear is missing
    // authMiddleware entirely, so req.user is undefined and the handler
    // throws reading req.user.id. It happens to fail closed (500, no
    // data touched) rather than open, but it should be a clean 401.
    // This test pins current behavior so a future change to this route
    // is a deliberate decision, not a silent regression either way.
    expect(res.status).toBe(500);
  });
});
