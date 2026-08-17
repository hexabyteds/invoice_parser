jest.mock("../../services/emailService", () => ({
  sendEmail: jest.fn(),
}));

const { request, app } = require("../helpers/api");
const emailService = require("../../services/emailService");

describe("POST /api/contact", () => {
  beforeEach(() => {
    emailService.sendEmail.mockReset();
  });

  it("rejects a missing name", async () => {
    const res = await request(app).post("/api/contact").send({
      email: "visitor@example.test",
      message: "I have a question about pricing.",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Visitor",
      email: "not-an-email",
      message: "I have a question about pricing.",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a too-short message", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Visitor",
      email: "visitor@example.test",
      message: "Hi",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("reports success without sending mail when the honeypot field is filled", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Bot",
      email: "bot@example.test",
      message: "This is an automated spam message.",
      company_website: "http://spam.example",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("sends a notification email and returns success for a valid submission", async () => {
    emailService.sendEmail.mockResolvedValueOnce({ messageId: "test" });

    const res = await request(app).post("/api/contact").send({
      name: "Jane Visitor",
      email: "jane@example.test",
      message: "Can you tell me more about the Business plan?",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    const call = emailService.sendEmail.mock.calls[0][0];
    expect(call.replyTo).toBe("jane@example.test");
    expect(call.subject).toContain("Jane Visitor");
  });

  it("does not leak internal error details when sending fails", async () => {
    emailService.sendEmail.mockRejectedValueOnce(
      new Error("SMTP connection ECONNREFUSED 10.0.0.1:465")
    );

    const res = await request(app).post("/api/contact").send({
      name: "Jane Visitor",
      email: "jane@example.test",
      message: "Can you tell me more about the Business plan?",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).not.toMatch(/ECONNREFUSED|10\.0\.0\.1/);
  });
});
