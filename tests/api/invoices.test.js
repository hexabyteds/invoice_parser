jest.mock("../../services/invoiceService");

const invoiceService = require("../../services/invoiceService");
const pool = require("../../config/database");
const { request, app, registerAndLogin, authed } = require("../helpers/api");
const {
  mockSuccessfulExtract,
  mockSuccessfulExtractPDF,
  mockExtractionFailure,
} = require("../mocks/invoiceService.mock");
const { samplePngBuffer, samplePdfBuffer } = require("../helpers/fixtures");

async function createClient(token, name = "Upload Client") {
  const res = await request(app)
    .post("/api/clients")
    .set(authed(token))
    .send({ company_name: name });
  return res.body.client.id;
}

function uploadImage(token, clientId, filename = "invoice.png") {
  return request(app)
    .post("/api/upload")
    .set(authed(token))
    .field("client_id", String(clientId))
    .attach("image", samplePngBuffer(), filename);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Invoice upload + parsing (Gemini mocked)", () => {
  it("uploads and parses an image invoice", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    const res = await uploadImage(token, clientId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoice.clientName).toBe("Acme Supplies LLC");
    expect(res.body.invoice.totalAmount).toBe("105.00");
    expect(res.body.validation.isValid).toBe(true);
  });

  it("uploads and parses a PDF invoice", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractPDF(invoiceService);

    const pdf = await samplePdfBuffer(1);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", pdf, "invoice.pdf");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalInvoices).toBe(1);
    expect(res.body.invoices[0].clientName).toBe("Acme Supplies LLC");
  });

  it("rejects upload with no client_id", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .attach("image", samplePngBuffer(), "invoice.png");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/client/i);
  });

  it("rejects unsupported file types", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", Buffer.from("not an image"), "notes.txt");

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("surfaces a Gemini extraction failure as a clean error, not a 500 crash", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockExtractionFailure(invoiceService, "Could not read this document.");

    const res = await uploadImage(token, clientId);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/upload")
      .field("client_id", "1")
      .attach("image", samplePngBuffer(), "invoice.png");

    expect(res.status).toBe(401);
  });
});

describe("Invoice management", () => {
  async function uploadOne(token, clientId) {
    mockSuccessfulExtract(invoiceService);
    const res = await uploadImage(token, clientId);
    return res.body.invoice;
  }

  it("lists invoices for the requesting user", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId);

    const res = await request(app).get("/api/invoices").set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
  });

  it("gets a single invoice with line items", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.lineItems).toHaveLength(2);
  });

  it("edits an invoice's fields", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({ invoice_no: "INV-EDITED", total_amount: 999.99 });

    expect(res.status).toBe(200);
    expect(res.body.invoice.invoice_no).toBe("INV-EDITED");
    expect(Number(res.body.invoice.total_amount)).toBe(999.99);
  });

  it("adds a manual line item via edit and persists it", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Existing item", quantity: 1, unit_price: 10, total_price: 10 },
          { description: "Manually added item", quantity: 3, unit_price: 20, total_price: 60 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.lineItems).toHaveLength(2);
    expect(res.body.lineItems.map((i) => i.description)).toContain(
      "Manually added item"
    );
  });

  it("removes a line item via edit (fewer items than before)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Only remaining item", quantity: 1, unit_price: 5, total_price: 5 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.lineItems).toHaveLength(1);
  });

  it("deletes an invoice", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const del = await request(app)
      .delete(`/api/invoices/${invoice.id}`)
      .set(authed(token));

    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set(authed(token));

    expect(get.status).toBe(404);
  });
});

describe("Invoice cross-user isolation", () => {
  async function uploadOne(token, clientId) {
    mockSuccessfulExtract(invoiceService);
    const res = await uploadImage(token, clientId);
    return res.body.invoice;
  }

  it("blocks user B from reading user A's invoice", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const invoice = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set(authed(userB.token));

    expect(res.status).toBe(404);
  });

  it("blocks user B from editing user A's invoice", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const invoice = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(userB.token))
      .send({ invoice_no: "HIJACKED" });

    expect(res.status).toBe(404);
  });

  it("blocks user B from deleting user A's invoice", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const invoice = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .delete(`/api/invoices/${invoice.id}`)
      .set(authed(userB.token));

    expect(res.status).toBe(404);

    const stillThere = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set(authed(userA.token));

    expect(stillThere.status).toBe(200);
  });
});

describe("Plan limit enforcement on upload", () => {
  it("blocks uploads once the invoice/OCR limit is reached", async () => {
    // Seeded Free plan: invoice_limit 5, ocr_limit 5 (tests/setup/globalSetup.js)
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    for (let i = 0; i < 5; i++) {
      const res = await uploadImage(token, clientId, `invoice-${i}.png`);
      expect(res.status).toBe(200);
    }

    const sixth = await uploadImage(token, clientId, "invoice-6.png");

    expect(sixth.status).toBe(403);
    expect(sixth.body.error).toMatch(/limit reached/i);
  });

  it("blocks uploads once the storage limit is reached", async () => {
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    // Free plan storage_limit is 50MB; push usage right up to the ceiling
    // so the next (tiny) upload tips it over, without uploading 50MB for real.
    await pool.execute(
      `UPDATE usage_stats SET storage_used = ? WHERE user_id = ?`,
      [50 * 1024 * 1024 - 10, user.id]
    );

    const res = await uploadImage(token, clientId);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/storage limit reached/i);
  });
});
