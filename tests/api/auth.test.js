const {
  request,
  app,
  registerAndLogin,
  uniqueEmail,
  uniqueMobileNumber,
} = require("../helpers/api");
const pool = require("../../config/database");
const { generateResetToken } = require("../../utils/resetToken");

describe("Auth", () => {
  describe("POST /api/auth/register", () => {
    it("registers a new user and returns a token + subscription", async () => {
      const email = uniqueEmail();

      const res = await request(app).post("/api/auth/register").send({
        name: "New User",
        email,
        password: "Password123!",
        account_type: "COMPANY",
        company_name: "New User Co",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.role).toBe("customer");
      expect(res.body.user.country).toBe("Pakistan");
      expect(res.body.user.country_code).toBe("+92");
      expect(res.body.subscription.plan).toBe("free");
    });

    it("rejects duplicate email registration", async () => {
      const { email } = await registerAndLogin();

      const res = await request(app).post("/api/auth/register").send({
        name: "Duplicate",
        email,
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects registration with missing required fields", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: uniqueEmail(),
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
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
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.body.user.password).toBeUndefined();
    });

    it("rejects a weak password (BUG-AUTH-001)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Weak Password",
        email: uniqueEmail(),
        password: "a",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/password/i);
    });

    it("rejects a password missing an uppercase letter, lowercase letter, or number (BUG-AUTH-001)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Weak Password",
        email: uniqueEmail(),
        password: "alllowercase",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects an invalid email format (BUG-AUTH-002)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Bad Email",
        email: "not-an-email",
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/email/i);

      // Confirm nothing was actually created for the malformed address.
      const [rows] = await pool.execute(
        `SELECT id FROM users WHERE email = ?`,
        ["not-an-email"]
      );
      expect(rows).toHaveLength(0);
    });

    it("rejects registration with a missing country", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "No Country",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/country/i);
    });

    it("rejects registration with a missing country code", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "No Country Code",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/country code/i);
    });

    it("rejects registration with a missing mobile number", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "No Mobile",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/mobile number/i);
    });

    it("rejects registration with a whitespace-only mobile number", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Whitespace Mobile",
        email: uniqueEmail(),
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: "   ",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects registration with an unrecognized country", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Fake Country",
        email: uniqueEmail(),
        password: "Password123!",
        country: "Narnia",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects a country/country_code combination that don't match", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Mismatched Code",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+971", // UAE's code, not Pakistan's
        mobile_number: uniqueMobileNumber(),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/country code/i);
    });

    it("rejects a mobile number with letters/invalid characters", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Bad Mobile",
        email: uniqueEmail(),
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: "abc123xyz",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects a mobile number that is too short", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Short Mobile",
        email: uniqueEmail(),
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: "123",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects a mobile number that is too long", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Long Mobile",
        email: uniqueEmail(),
        password: "Password123!",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: "123456789012345678",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("accepts a mobile number typed with the country code already included", async () => {
      const email = uniqueEmail();
      const localNumber = uniqueMobileNumber();

      const res = await request(app).post("/api/auth/register").send({
        name: "Typed With Code",
        email,
        password: "Password123!",
        account_type: "FREELANCER",
        country: "United Arab Emirates",
        country_code: "+971",
        mobile_number: `+971${localNumber}`,
      });

      expect(res.status).toBe(201);
      expect(res.body.user.mobile_number).toBe(localNumber);
    });

    it("rejects a duplicate mobile number (same country_code + mobile_number)", async () => {
      const mobileNumber = uniqueMobileNumber();

      const first = await request(app).post("/api/auth/register").send({
        name: "First Owner",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: mobileNumber,
      });
      expect(first.status).toBe(201);

      const second = await request(app).post("/api/auth/register").send({
        name: "Second Owner",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: mobileNumber,
      });

      expect(second.status).toBe(400);
      expect(second.body.success).toBe(false);
      expect(second.body.error).toMatch(/mobile number/i);
    });

    it("allows the same mobile number under a different country/country_code", async () => {
      const mobileNumber = uniqueMobileNumber();

      const first = await request(app).post("/api/auth/register").send({
        name: "PK Owner",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: mobileNumber,
      });
      expect(first.status).toBe(201);

      const second = await request(app).post("/api/auth/register").send({
        name: "UAE Owner",
        email: uniqueEmail(),
        password: "Password123!",
        account_type: "FREELANCER",
        country: "United Arab Emirates",
        country_code: "+971",
        mobile_number: mobileNumber,
      });

      expect(second.status).toBe(201);
    });

    it("updates the country code automatically across different countries", async () => {
      const cases = [
        { country: "Pakistan", country_code: "+92" },
        { country: "United Arab Emirates", country_code: "+971" },
        { country: "United States", country_code: "+1" },
      ];

      for (const { country, country_code } of cases) {
        const res = await request(app).post("/api/auth/register").send({
          name: "Country Switch",
          email: uniqueEmail(),
          password: "Password123!",
          account_type: "FREELANCER",
          country,
          country_code,
          mobile_number: uniqueMobileNumber(),
        });

        expect(res.status).toBe(201);
        expect(res.body.user.country).toBe(country);
        expect(res.body.user.country_code).toBe(country_code);
      }
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

    it("rejects a missing email with a clean 400, not a raw DB driver error (BUG-AUTH-003)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "whatever" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/email/i);
      expect(res.body.error).not.toMatch(/mysql|bind parameters|sql/i);
    });

    it("rejects a missing password with a clean 400, not a raw bcrypt error (BUG-AUTH-003)", async () => {
      const { email } = await registerAndLogin();

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/password/i);
      expect(res.body.error).not.toMatch(/bcrypt|hash argument/i);
    });

    it("rejects an empty request body with a clean 400", async () => {
      const res = await request(app).post("/api/auth/login").send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    async function seedResetToken(userId) {
      const { token, tokenHash, expiresAt } = generateResetToken();
      await pool.execute(
        `UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?`,
        [tokenHash, expiresAt, userId]
      );
      return token;
    }

    it("rejects a weak new password even with a valid reset token (BUG-AUTH-001)", async () => {
      const { user } = await registerAndLogin();
      const token = await seedResetToken(user.id);

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, password: "a" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/password/i);

      // The old password must still work — the weak one was never applied.
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "Password123!" });
      expect(login.status).toBe(200);
    });

    it("accepts a strong new password with a valid reset token", async () => {
      const { user } = await registerAndLogin();
      const token = await seedResetToken(user.id);

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, password: "NewStrongPass1" });

      expect(res.status).toBe(200);

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "NewStrongPass1" });
      expect(login.status).toBe(200);
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

  describe("GET /api/auth/recent-logins", () => {
    // Calls authService.login() directly rather than POST /api/auth/login
    // for the "does it get recorded" cases below — the route sits behind
    // loginRateLimiter (10 requests / 15 min), and the POST /api/auth/login
    // describe block above plus the reset-password tests already use the
    // file's full budget of real HTTP login calls. The service call
    // exercises the exact same recording code path (authService.login)
    // without touching that middleware.
    const authService = require("../../services/authService");

    it("rejects requests with no Authorization header", async () => {
      const res = await request(app).get("/api/auth/recent-logins");

      expect(res.status).toBe(401);
    });

    it("is empty for a user who has never logged in", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .get("/api/auth/recent-logins")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toEqual([]);
    });

    it("records ip/browser/device on a successful login and returns it newest-first", async () => {
      const { email, password, token } = await registerAndLogin();

      await authService.login(email, password, {
        ipAddress: "203.0.113.5",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
      });

      const res = await request(app)
        .get("/api/auth/recent-logins")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.history.length).toBe(1);
      expect(res.body.history[0].ip_address).toBe("203.0.113.5");
      expect(res.body.history[0].browser).toBe("Chrome");
      expect(res.body.history[0].device).toBe("Windows PC");
      expect(res.body.history[0].login_time).toBeTruthy();
    });

    it("falls back to Unknown/Unknown without failing the login when no User-Agent is supplied", async () => {
      const { email, password, token } = await registerAndLogin();

      await expect(
        authService.login(email, password, {})
      ).resolves.toBeTruthy();

      const res = await request(app)
        .get("/api/auth/recent-logins")
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.history[0].browser).toBe("Unknown");
      expect(res.body.history[0].device).toBe("Unknown");
    });

    it("only ever returns the authenticated caller's own login history", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();

      await authService.login(userA.email, userA.password, {});

      const historyB = await request(app)
        .get("/api/auth/recent-logins")
        .set("Authorization", `Bearer ${userB.token}`);

      expect(historyB.body.history).toEqual([]);
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

    it("does not require country/mobile fields for a name-only update (pre-existing account)", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Just A Rename" });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Just A Rename");
    });

    it("lets an existing user complete country/country_code/mobile_number together", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Test User",
          country: "United Arab Emirates",
          country_code: "+971",
          mobile_number: uniqueMobileNumber(),
        });

      expect(res.status).toBe(200);
      expect(res.body.user.country).toBe("United Arab Emirates");
      expect(res.body.user.country_code).toBe("+971");
    });

    it("rejects an update that sets mobile_number without country", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Test User", mobile_number: uniqueMobileNumber() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects an update to a mobile number already used by another account", async () => {
      const owner = await registerAndLogin();
      const other = await registerAndLogin();

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${other.token}`)
        .send({
          name: "Other User",
          country: owner.user.country,
          country_code: owner.user.country_code,
          mobile_number: owner.user.mobile_number,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/mobile number/i);
    });
  });
});
