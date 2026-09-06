// Same convention as tests/api/contact.test.js — these tests exercise the
// invitation/registration flow itself, not whether SMTP is reachable (it
// isn't, in this environment), and every email send is already best-effort
// (try/catch'd) in the production code, so a real network attempt here
// would only make the suite slow/flaky without testing anything real.
jest.mock("../../services/emailService", () => ({
  sendEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendCompanyInvitationEmail: jest.fn(),
  sendInvitationAcceptedEmailToFreelancer: jest.fn(),
  sendInvitationAcceptedEmailToInviter: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

const {
  request,
  app,
  registerAndLogin,
  uniqueEmail,
  uniqueMobileNumber,
  authed,
} = require("../helpers/api");
const pool = require("../../config/database");
const companyInvitationRepository = require("../../repositories/companyInvitationRepository");
const { generateInviteToken } = require("../../utils/inviteToken");

// Seeds a company_invitations row directly (bypassing the HTTP invite
// endpoint) so tests can get their hands on the raw token — which, like a
// password reset token, is only ever emailed, never returned by any API
// response. Mirrors auth.test.js's seedResetToken helper for the same
// reason.
async function seedInvitation({ companyId, invitedEmail, invitedBy, permissions = null, expiresAt }) {
  const generated = generateInviteToken();
  const expires = expiresAt || generated.expiresAt;

  const id = await companyInvitationRepository.create({
    companyId,
    invitedEmail: invitedEmail.trim().toLowerCase(),
    invitedBy,
    permissions,
    tokenHash: generated.tokenHash,
    expiresAt: expires,
  });

  return { id, token: generated.token };
}

async function ownedCompanyId(token) {
  const res = await request(app)
    .get("/api/companies/current")
    .set(authed(token));
  return res.body.company.id;
}

async function membershipRow(companyId, userId) {
  const [rows] = await pool.execute(
    `SELECT * FROM company_memberships WHERE company_id = ? AND user_id = ?`,
    [companyId, userId]
  );
  return rows[0] || null;
}

describe("Company invitations", () => {
  describe("POST /api/companies/team/invite", () => {
    it("creates a pending invitation for an email with no account yet", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const invitedEmail = uniqueEmail("newfreelancer");

      const res = await request(app)
        .post("/api/companies/team/invite")
        .set(authed(owner.token))
        .send({ email: invitedEmail });

      expect(res.status).toBe(201);

      const list = await request(app)
        .get("/api/companies/team/invitations")
        .set(authed(owner.token));

      expect(list.body.invitations.some((i) => i.invitedEmail === invitedEmail && i.status === "PENDING")).toBe(true);
    });

    it("rejects an invalid email format", async () => {
      const owner = await registerAndLogin();

      const res = await request(app)
        .post("/api/companies/team/invite")
        .set(authed(owner.token))
        .send({ email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid email/i);
    });

    it("rejects inviting an email that belongs to a Company account", async () => {
      const owner = await registerAndLogin();
      const otherCompany = await registerAndLogin();

      const res = await request(app)
        .post("/api/companies/team/invite")
        .set(authed(owner.token))
        .send({ email: otherCompany.email });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Company account/i);
    });

    it("rejects a duplicate pending invitation for the same email, pointing at Resend", async () => {
      const owner = await registerAndLogin();
      const invitedEmail = uniqueEmail("dup");

      const first = await request(app)
        .post("/api/companies/team/invite")
        .set(authed(owner.token))
        .send({ email: invitedEmail });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post("/api/companies/team/invite")
        .set(authed(owner.token))
        .send({ email: invitedEmail });

      expect(second.status).toBe(400);
      expect(second.body.error).toMatch(/resend/i);
    });

    it("rejects inviting a freelancer who already has active access to the company", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });

      const { token } = await seedInvitation({
        companyId,
        invitedEmail: freelancer.email,
        invitedBy: owner.user.id,
      });

      const accept = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));
      expect(accept.status).toBe(200);

      const res = await request(app)
        .post("/api/companies/team/invite")
        .set(authed(owner.token))
        .send({ email: freelancer.email });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already has access/i);
    });

    it("requires team-manage permission (a non-owner can't invite)", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });

      const { token } = await seedInvitation({
        companyId,
        invitedEmail: freelancer.email,
        invitedBy: owner.user.id,
      });
      await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));

      const res = await request(app)
        .post("/api/companies/team/invite")
        .set({ ...authed(freelancer.token), "X-Company-Id": String(companyId) })
        .send({ email: uniqueEmail("blocked") });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/invitations/token/:token (public preview)", () => {
    it("is reachable with no Authorization header", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const invitedEmail = uniqueEmail("preview");
      const { token } = await seedInvitation({ companyId, invitedEmail, invitedBy: owner.user.id });

      const res = await request(app).get(`/api/invitations/token/${token}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.invitedEmail).toBe(invitedEmail);
      expect(res.body.accountExists).toBe(false);
      // Only what's needed to render the acceptance screen — no address/TRN/etc.
      expect(res.body).not.toHaveProperty("address");
      expect(res.body).not.toHaveProperty("trn");
    });

    it("reports accountExists: true once the invited email has signed up", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });

      const { token } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      const res = await request(app).get(`/api/invitations/token/${token}`);
      expect(res.body.accountExists).toBe(true);
    });

    it("is invalid for an unknown token", async () => {
      const res = await request(app).get("/api/invitations/token/not-a-real-token");
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it("is invalid for an expired token", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const { token } = await seedInvitation({
        companyId,
        invitedEmail: uniqueEmail("expired"),
        invitedBy: owner.user.id,
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      const res = await request(app).get(`/api/invitations/token/${token}`);
      expect(res.body.valid).toBe(false);
    });
  });

  describe("Case A — signup via invite link (no account yet)", () => {
    it("auto-accepts the invitation as part of registration and connects the company", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const invitedEmail = uniqueEmail("signupviainvite");
      const { token } = await seedInvitation({ companyId, invitedEmail, invitedBy: owner.user.id });

      const res = await request(app).post("/api/auth/register").send({
        name: "Invited Freelancer",
        email: invitedEmail,
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
        invitation_token: token,
      });

      expect(res.status).toBe(201);
      expect(res.body.invitationAccepted).toBe(true);

      const me = await request(app)
        .get("/api/auth/me")
        .set(authed(res.body.token));

      expect(me.body.user.companies.some((c) => c.companyId === companyId && c.role === "FREELANCER")).toBe(true);

      const membership = await membershipRow(companyId, res.body.user.id);
      expect(membership.status).toBe("ACTIVE");
    });

    it("does not fail signup when the invitation token is invalid/expired — just skips the auto-connect", async () => {
      const invitedEmail = uniqueEmail("badtoken");

      const res = await request(app).post("/api/auth/register").send({
        name: "Bad Token Signup",
        email: invitedEmail,
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
        invitation_token: "not-a-real-token",
      });

      expect(res.status).toBe(201);
      expect(res.body.invitationAccepted).toBe(false);
    });
  });

  describe("Case B/C — accepting as an existing Freelancer", () => {
    it("accepts via the emailed token", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { token } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      const res = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));

      expect(res.status).toBe(200);

      const membership = await membershipRow(companyId, freelancer.user.id);
      expect(membership.status).toBe("ACTIVE");
      expect(membership.role).toBe("FREELANCER");
    });

    it("accepts in-app with no token (matching email, authenticated session)", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { id } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      const res = await request(app)
        .post(`/api/companies/invitations/${id}/accept`)
        .set(authed(freelancer.token));

      expect(res.status).toBe(200);

      const membership = await membershipRow(companyId, freelancer.user.id);
      expect(membership.status).toBe("ACTIVE");
    });

    it("declines in-app, and a declined invitation can no longer be accepted", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { id, token } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      const decline = await request(app)
        .post(`/api/companies/invitations/${id}/decline`)
        .set(authed(freelancer.token));
      expect(decline.status).toBe(200);

      const accept = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));
      expect(accept.status).toBe(400);

      const membership = await membershipRow(companyId, freelancer.user.id);
      expect(membership).toBeNull();
    });

    it("blocks acceptance when the authenticated caller's email doesn't match the invited email, and creates no membership", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const invitedEmail = uniqueEmail("intended-recipient");
      const someoneElse = await registerAndLogin({ account_type: "FREELANCER" });
      const { token } = await seedInvitation({ companyId, invitedEmail, invitedBy: owner.user.id });

      const res = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(someoneElse.token));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/another email address/i);

      const membership = await membershipRow(companyId, someoneElse.user.id);
      expect(membership).toBeNull();
    });

    it("cannot accept the same token twice", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { token } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      const first = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));
      expect(first.status).toBe(200);

      const second = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));
      expect(second.status).toBe(400);
    });

    it("rejects acceptance of an expired invitation", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { token } = await seedInvitation({
        companyId,
        invitedEmail: freelancer.email,
        invitedBy: owner.user.id,
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      const res = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));

      expect(res.status).toBe(400);

      const membership = await membershipRow(companyId, freelancer.user.id);
      expect(membership).toBeNull();
    });
  });

  describe("Resend / Revoke", () => {
    it("resend invalidates the previous token", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const { id, token } = await seedInvitation({ companyId, invitedEmail: uniqueEmail("resend"), invitedBy: owner.user.id });

      const resend = await request(app)
        .post(`/api/companies/team/invitations/${id}/resend`)
        .set(authed(owner.token));
      expect(resend.status).toBe(200);

      const preview = await request(app).get(`/api/invitations/token/${token}`);
      expect(preview.body.valid).toBe(false);
    });

    it("a revoked invitation can no longer be accepted", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { id, token } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      const revoke = await request(app)
        .post(`/api/companies/team/invitations/${id}/revoke`)
        .set(authed(owner.token));
      expect(revoke.status).toBe(200);

      const res = await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));
      expect(res.status).toBe(400);
    });

    it("cannot revoke an already-accepted invitation", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });
      const { id, token } = await seedInvitation({ companyId, invitedEmail: freelancer.email, invitedBy: owner.user.id });

      await request(app)
        .post(`/api/invitations/token/${token}/accept`)
        .set(authed(freelancer.token));

      const revoke = await request(app)
        .post(`/api/companies/team/invitations/${id}/revoke`)
        .set(authed(owner.token));

      expect(revoke.status).toBe(400);
    });
  });

  describe("No duplicate accounts/companies", () => {
    it("signup via invite creates exactly one user row and no new company row", async () => {
      const owner = await registerAndLogin();
      const companyId = await ownedCompanyId(owner.token);
      const invitedEmail = uniqueEmail("noduplicate");
      const { token } = await seedInvitation({ companyId, invitedEmail, invitedBy: owner.user.id });

      const [beforeCompanies] = await pool.execute(`SELECT COUNT(*) AS n FROM companies`);

      await request(app).post("/api/auth/register").send({
        name: "No Duplicate",
        email: invitedEmail,
        password: "Password123!",
        account_type: "FREELANCER",
        country: "Pakistan",
        country_code: "+92",
        mobile_number: uniqueMobileNumber(),
        invitation_token: token,
      });

      const [afterCompanies] = await pool.execute(`SELECT COUNT(*) AS n FROM companies`);
      const [users] = await pool.execute(`SELECT COUNT(*) AS n FROM users WHERE email = ?`, [invitedEmail]);

      expect(afterCompanies[0].n).toBe(beforeCompanies[0].n);
      expect(users[0].n).toBe(1);
    });
  });

  describe("Independent Freelancer signup", () => {
    it("signs up without any invitation and can add a company afterwards", async () => {
      const freelancer = await registerAndLogin({ account_type: "FREELANCER" });

      const create = await request(app)
        .post("/api/companies")
        .set(authed(freelancer.token))
        .send({ name: "My Own Bookkeeping Co" });

      expect(create.status).toBe(201);

      const me = await request(app)
        .get("/api/auth/me")
        .set(authed(freelancer.token));

      const owned = me.body.user.companies.find((c) => c.companyId === create.body.companyId);
      expect(owned.role).toBe("OWNER");
    });
  });
});
