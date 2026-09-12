const pool = require("../../config/database");

// Global default so every test file's registerAndLogin()/etc. never makes
// a real SMTP connection — .env.test's SMTP_* vars point at the real
// production mail server (needed for the couple of tests that
// specifically exercise email content), and without this, any suite that
// registers more than a handful of users blocks on live network I/O per
// registration, at best slow and at worst — under real-world SMTP
// throttling/latency — timing out and cascading into unrelated test
// failures once Jest tears down the DB pool out from under a still-hung
// request. contact.test.js and invitations.test.js already override this
// per-file with their own jest.mock() (which takes precedence for that
// file) to assert on send calls; every other file gets this silent stub.
jest.mock("../../services/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue({}),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
  sendVerificationEmail: jest.fn().mockResolvedValue({}),
  sendCompanyInvitationEmail: jest.fn().mockResolvedValue({}),
  sendInvitationAcceptedEmailToFreelancer: jest.fn().mockResolvedValue({}),
  sendInvitationAcceptedEmailToInviter: jest.fn().mockResolvedValue({}),
  verifyConnection: jest.fn().mockResolvedValue(true),
}));

afterAll(async () => {
  await pool.end();
});
