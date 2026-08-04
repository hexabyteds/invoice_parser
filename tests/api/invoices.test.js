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

function uploadImage(token, clientId, filename = "invoice.png", documentType) {
  const req = request(app)
    .post("/api/upload")
    .set(authed(token))
    .field("client_id", String(clientId));

  if (documentType !== undefined) {
    req.field("document_type", documentType);
  }

  return req.attach("image", samplePngBuffer(), filename);
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

  it("rejects unsupported file types with a clean JSON error", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", Buffer.from("not an image"), "notes.txt");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/pdf|jpg|png/i);
  });

  it("rejects files over the server-side size limit with a clean 413, not a hang or an HTML error page", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    const oversized = Buffer.alloc(21 * 1024 * 1024, 1); // over the 20 MB cap

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", oversized, {
        filename: "huge.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/too large/i);
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

describe("Invoice document type (category)", () => {
  it("uploads a Supplier Invoice and persists the type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    const res = await uploadImage(token, clientId, "invoice.png", "supplier_invoice");

    expect(res.status).toBe(200);
    expect(res.body.invoice.document_type).toBe("supplier_invoice");
  });

  it("uploads a Bill and persists the type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    const res = await uploadImage(token, clientId, "invoice.png", "bill");

    expect(res.status).toBe(200);
    expect(res.body.invoice.document_type).toBe("bill");
  });

  it("rejects an unsupported document type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    const res = await uploadImage(token, clientId, "invoice.png", "not_a_real_type");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid document type/i);
  });

  it("still accepts an upload with no document type (legacy/back-compat)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    const res = await uploadImage(token, clientId);

    expect(res.status).toBe(200);
    expect(res.body.invoice.document_type).toBeFalsy();
  });

  it("filters the invoice list by document_type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "supplier.png", "supplier_invoice");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "bill.png", "bill");

    const supplierRes = await request(app)
      .get("/api/invoices?document_type=supplier_invoice")
      .set(authed(token));

    expect(supplierRes.status).toBe(200);
    expect(supplierRes.body.invoices).toHaveLength(1);
    expect(supplierRes.body.invoices[0].documentType).toBe("supplier_invoice");

    const billRes = await request(app)
      .get("/api/invoices?document_type=bill")
      .set(authed(token));

    expect(billRes.status).toBe(200);
    expect(billRes.body.invoices).toHaveLength(1);
    expect(billRes.body.invoices[0].documentType).toBe("bill");

    const allRes = await request(app).get("/api/invoices").set(authed(token));
    expect(allRes.body.invoices).toHaveLength(2);
  });

  it("rejects an invalid document_type filter on the list endpoint", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/invoices?document_type=nonsense")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("updates an invoice's document type via edit", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);
    const uploadRes = await uploadImage(token, clientId, "invoice.png", "supplier_invoice");
    const invoice = uploadRes.body.invoice;

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({ document_type: "bill" });

    expect(res.status).toBe(200);
    expect(res.body.invoice.document_type).toBe("bill");
  });

  it("rejects an invalid document type on edit", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);
    const uploadRes = await uploadImage(token, clientId, "invoice.png", "bill");
    const invoice = uploadRes.body.invoice;

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({ document_type: "totally_invalid" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
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
    expect(res.body.pagination).toEqual({
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it("paginates invoices with limit and offset", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const first = await uploadOne(token, clientId);
    const second = await uploadOne(token, clientId);

    const res = await request(app)
      .get("/api/invoices?limit=1&offset=1")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].id).toBe(first.id);
    expect(res.body.invoices[0].id).not.toBe(second.id);
    expect(res.body.pagination).toEqual({
      total: 2,
      limit: 1,
      offset: 1,
      hasMore: false,
    });
  });

  it("rejects invalid invoice pagination parameters", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/invoices?limit=101&offset=-1")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
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

describe("Rate limiting on upload", () => {
  // The rate limiter runs before multer/business logic, so it counts every
  // request regardless of what the handler would otherwise do with it —
  // no need for a real file or a valid client_id to prove it fires.
  it("blocks a single user past the per-minute upload limit with a 429", async () => {
    const { token } = await registerAndLogin();

    let lastStatus;
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post("/api/upload").set(authed(token));
      lastStatus = res.status;
    }
    expect(lastStatus).not.toBe(429);

    const blocked = await request(app).post("/api/upload").set(authed(token));

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error).toMatch(/too many/i);
  });

  it("rate limits per user, not globally — one user hitting the limit doesn't affect another", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    for (let i = 0; i < 20; i++) {
      await request(app).post("/api/upload").set(authed(userA.token));
    }

    const blockedForA = await request(app)
      .post("/api/upload")
      .set(authed(userA.token));
    expect(blockedForA.status).toBe(429);

    const stillOkForB = await request(app)
      .post("/api/upload")
      .set(authed(userB.token));
    expect(stillOkForB.status).not.toBe(429);
  });
});

describe("Concurrency — usage limits cannot be exceeded by parallel requests (PERF-02)", () => {
  // Driven directly against FreeInvoiceAgent/usageService (the same code
  // the /api/upload route calls) rather than through HTTP: firing many
  // requests through supertest's ephemeral per-call listeners adds test-
  // harness overhead unrelated to the app (each call binds its own
  // throwaway server), which is a separate, much lower-value thing to
  // prove than "the reservation itself can't be raced." This isolates
  // exactly the atomic-reservation logic these fixes are about.
  const FreeInvoiceAgent = require("../../free-invoice-agent");
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  it("invoice limit: firing more concurrent uploads than the plan allows never lets invoices_used exceed the limit", async () => {
    // Seeded Free plan: invoice_limit 5 (tests/setup/globalSetup.js).
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtract(invoiceService);

    // The seeded Free plan's ocr_limit is also 5 and is reserved first per
    // upload, so with the default plan it — not the invoice limit — would
    // be the one that actually trips (still proves the count never
    // overshoots, but doesn't isolate the invoice-reservation path
    // specifically). Give this user a generous OCR budget so the invoice
    // limit is unambiguously the constraint under test here.
    const [planResult] = await pool.execute(
      `INSERT INTO plans (name, slug, invoice_limit, client_limit, ocr_limit, storage_limit, user_limit, active)
       VALUES (?, ?, 5, 100, 1000, 5000, 1, 1)`,
      [`Concurrency Test ${user.id}`, `concurrency-test-${user.id}`]
    );
    await pool.execute(
      `UPDATE subscriptions SET plan_id = ? WHERE user_id = ? AND status = 'active'`,
      [planResult.insertId, user.id]
    );

    const agent = new FreeInvoiceAgent();
    const CONCURRENCY = 10;
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        agent.processImage(`/fake/path-${i}.png`, user.id, clientId)
      )
    );

    const succeeded = settled.filter(
      (r) => r.status === "fulfilled" && r.value.status === "success"
    );
    const blocked = settled.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(5);
    expect(blocked).toHaveLength(CONCURRENCY - 5);
    blocked.forEach((r) =>
      expect(r.reason.message).toMatch(/invoice limit reached/i)
    );

    const [rows] = await pool.execute(
      `SELECT invoices_used FROM usage_stats WHERE user_id = ?`,
      [user.id]
    );
    expect(rows[0].invoices_used).toBe(5);
  });

  it("OCR limit: concurrent multi-page PDF uploads never let ocr_pages_used exceed the limit", async () => {
    // Seeded Free plan: ocr_limit 5. Each upload here is a real 3-page PDF
    // (only 1 invoice extracted per PDF via the mock), so OCR pages — not
    // invoice count — is the binding constraint: only one upload's 3 pages
    // fit in the 5-page budget (3 + 3 > 5), isolating OCR reservation
    // concurrency from the invoice-slot test above.
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractPDF(invoiceService);

    const pdfPath = path.join(os.tmpdir(), `concurrency-test-${user.id}.pdf`);
    fs.writeFileSync(pdfPath, await samplePdfBuffer(3));

    const agent = new FreeInvoiceAgent();
    const CONCURRENCY = 5;
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        agent.processPDF(pdfPath, user.id, clientId)
      )
    );
    fs.unlinkSync(pdfPath);

    const succeeded = settled.filter(
      (r) => r.status === "fulfilled" && r.value.status === "success"
    );
    const blocked = settled.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(blocked).toHaveLength(CONCURRENCY - 1);
    blocked.forEach((r) =>
      expect(r.reason.message).toMatch(/ocr page limit reached/i)
    );

    const [rows] = await pool.execute(
      `SELECT ocr_pages_used FROM usage_stats WHERE user_id = ?`,
      [user.id]
    );
    expect(rows[0].ocr_pages_used).toBe(3);
  });
});
