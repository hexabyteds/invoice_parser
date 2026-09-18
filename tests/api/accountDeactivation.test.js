// Covers the 7-day "verify your email or lose access" rule added to
// services/authService.js's login(): an account that never confirms its
// email within 7 days of signing up gets deactivated at the next login
// attempt (lazy, checked-on-access — same pattern the trial system already
// uses, no cron/scheduler). A real paying (active, non-trial) subscription
// is exempt. Verifying email reactivates a deactivated account.

const pool = require("../../config/database");
const { request, app, registerAndLogin } = require("../helpers/api");
const emailService = require("../../services/emailService");

function extractTokenFromVerifyUrl(url) {
  const match = url.match(/[?&]token=([^&]+)/);
  return match ? match[1] : null;
}

async function backdateSignup(userId, daysAgo) {
  await pool.execute(
    `UPDATE users SET created_at = DATE_SUB(NOW(), INTERVAL ? DAY) WHERE id = ?`,
    [daysAgo, userId]
  );
}

async function getUserStatus(userId) {
  const [[row]] = await pool.execute(`SELECT status FROM users WHERE id = ?`, [userId]);
  return row.status;
}

describe("Unverified account deactivation (7-day rule)", () => {
  beforeEach(() => {
    emailService.sendVerificationEmail.mockClear();
  });

  it("does not deactivate an unverified account within the 7-day window", async () => {
    const { email, password } = await registerAndLogin();

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
  });

  it("deactivates an unverified account once more than 7 days have passed, and blocks login going forward", async () => {
    const { user, email, password } = await registerAndLogin();
    await backdateSignup(user.id, 8);

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/deactivated/i);
    expect(res.body.error).toMatch(/verif/i);
    expect(await getUserStatus(user.id)).toBe("INACTIVE");

    // Confirms it's actually persisted, not just a one-time rejection.
    const again = await request(app).post("/api/auth/login").send({ email, password });
    expect(again.status).toBe(401);
    expect(again.body.error).toBe("This account has been suspended.");
  });

  it("does not deactivate a verified account even long after 7 days", async () => {
    const { user, email, password } = await registerAndLogin();
    await pool.execute(`UPDATE users SET email_verified = 1 WHERE id = ?`, [user.id]);
    await backdateSignup(user.id, 30);

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
  });

  it("does not deactivate a paying (active subscription) account even if unverified after 7 days", async () => {
    const { user, email, password } = await registerAndLogin();
    await pool.execute(`UPDATE subscriptions SET status = 'active' WHERE user_id = ?`, [user.id]);
    await backdateSignup(user.id, 30);

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(await getUserStatus(user.id)).toBe("ACTIVE");
  });

  it("records an audit log entry when deactivating", async () => {
    const { user, email, password } = await registerAndLogin();
    await backdateSignup(user.id, 10);

    await request(app).post("/api/auth/login").send({ email, password });

    const [[logRow]] = await pool.execute(
      `SELECT description FROM audit_logs WHERE user_id = ? AND action = 'account_deactivated'`,
      [user.id]
    );

    expect(logRow).toBeDefined();
    expect(logRow.description).toMatch(/not verified/i);
  });

  it("reactivates a deactivated account once the user verifies their email with a still-valid token", async () => {
    const { user, email, password } = await registerAndLogin();

    // Grab the raw verification token "emailed" at registration (real
    // token/URL, sendVerificationEmail itself is mocked globally —
    // tests/setup/testLifecycle.js — so no real SMTP call happens).
    const call = emailService.sendVerificationEmail.mock.calls.find((c) => c[0] === email);
    expect(call).toBeDefined();
    const token = extractTokenFromVerifyUrl(call[1]);
    expect(token).toBeTruthy();

    await backdateSignup(user.id, 10);

    const blocked = await request(app).post("/api/auth/login").send({ email, password });
    expect(blocked.status).toBe(401);
    expect(await getUserStatus(user.id)).toBe("INACTIVE");

    const verifyRes = await request(app).get(`/api/auth/verify-email/${token}`);
    expect(verifyRes.status).toBe(200);
    expect(await getUserStatus(user.id)).toBe("ACTIVE");

    const restored = await request(app).post("/api/auth/login").send({ email, password });
    expect(restored.status).toBe(200);
  });
});
