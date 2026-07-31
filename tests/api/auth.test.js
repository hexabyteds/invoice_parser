const { request, app, registerAndLogin, uniqueEmail } = require("../helpers/api");

describe("Auth", () => {
  describe("POST /api/auth/register", () => {
    it("registers a new user and returns a token + subscription", async () => {
      const email = uniqueEmail();

      const res = await request(app).post("/api/auth/register").send({
        name: "New User",
        email,
        password: "Password123!",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.role).toBe("customer");
      expect(res.body.subscription.plan).toBe("free");
    });

    it("rejects duplicate email registration", async () => {
      const { email } = await registerAndLogin();

      const res = await request(app).post("/api/auth/register").send({
        name: "Duplicate",
        email,
        password: "Password123!",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects registration with missing required fields", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: uniqueEmail(),
        password: "Password123!",
        // name missing
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("does not leak the password hash in the response", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "No Leak",
        email: uniqueEmail(),
        password: "Password123!",
      });

      expect(res.body.user.password).toBeUndefined();
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with correct credentials", async () => {
      const { email, password } = await registerAndLogin();

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it("rejects an unknown email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: uniqueEmail("nobody"), password: "whatever" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects a wrong password", async () => {
      const { email } = await registerAndLogin();

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("does not reveal whether the email or the password was wrong", async () => {
      const { email } = await registerAndLogin();

      const wrongPassword = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" });

      const unknownEmail = await request(app)
        .post("/api/auth/login")
        .send({ email: uniqueEmail("nobody"), password: "whatever" });

      expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
    });
  });

  describe("GET /api/auth/me — route protection", () => {
    it("rejects requests with no Authorization header", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });

    it("rejects a malformed token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer not-a-real-token");

      expect(res.status).toBe(401);
    });

    it("returns the current user for a valid token", async () => {
      const { token, user } = await registerAndLogin();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(user.email);
    });
  });

  describe("PUT /api/auth/profile", () => {
    it("requires authentication", async () => {
      const res = await request(app)
        .put("/api/auth/profile")
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("updates name and company_name for the authenticated user", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Name", company_name: "Updated Co" });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Updated Name");
      expect(res.body.user.company_name).toBe("Updated Co");

      const me = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(me.body.user.name).toBe("Updated Name");
      expect(me.body.user.company_name).toBe("Updated Co");
    });

    it("rejects an empty name", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "   ", company_name: "Co" });

      expect(res.status).toBe(400);
    });

    it("only ever updates the authenticated caller's own profile", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();

      await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({ name: "A's New Name" });

      const meB = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${userB.token}`);

      expect(meB.body.user.name).not.toBe("A's New Name");
    });
  });
});
