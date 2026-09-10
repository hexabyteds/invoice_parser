jest.mock("../../services/invoiceService");

const fs = require("fs");
const path = require("path");
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
    .post("/api/customers")
    .set(authed(token))
    .send({ company_name: name });
  return res.body.customer.id;
}

// A Bill's party is a supplier (invoices.supplier_id), not a customer —
// see invoiceRepository.create().
async function createSupplier(token, name = "Upload Supplier") {
  const res = await request(app)
    .post("/api/suppliers")
    .set(authed(token))
    .send({
      company_name: name,
      email: "vendor@example.test",
      phone: "1234567890",
      billing_country: "AE",
      billing_city: "Dubai",
      trn: "100000000000000",
    });
  return res.body.supplier.id;
}

// registerAndLogin() registers a COMPANY account (see tests/helpers/api.js)
// but its response isn't enriched with companies[] the way /auth/login's
// is — resolved directly here for the two tests below that call
// FreeInvoiceAgent's processImage/processPDF outside of HTTP (so there's
// no companyContext middleware to resolve it for them).
async function ownedCompanyId(userId) {
  const [[row]] = await pool.execute(
    `SELECT id FROM companies WHERE owner_user_id = ? LIMIT 1`,
    [userId]
  );
  return row.id;
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

  it("auto-creates a customer when no client_id is given and the buyer is identifiable (Supplier Invoice)", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: { buyerName: "Bayut Web Publishing FZ LLC", buyerTrn: "104105756100003" },
    });

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "supplier_invoice")
      .attach("image", samplePngBuffer(), "invoice.png");

    expect(res.status).toBe(200);
    expect(res.body.invoice.clientName).toBe("Bayut Web Publishing FZ LLC");
    expect(res.body.customerResolution.status).toBe("created");
    expect(res.body.invoice.client_id).toBe(res.body.customerResolution.id);

    const customers = await request(app)
      .get("/api/customers")
      .set(authed(token));

    expect(customers.body.customers).toHaveLength(1);
    expect(customers.body.customers[0].company_name).toBe("Bayut Web Publishing FZ LLC");
    expect(customers.body.customers[0].trn).toBe("104105756100003");
  });

  it("auto-matches an existing customer by TRN, not a duplicate, when the same buyer is uploaded twice", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: { buyerName: "Bayut Web Publishing FZ LLC", buyerTrn: "104105756100003" },
    });

    const first = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "supplier_invoice")
      .attach("image", samplePngBuffer(), "invoice1.png");

    expect(first.body.customerResolution.status).toBe("created");

    // A minor punctuation/casing difference from the first upload — should
    // still match by TRN rather than create a second customer.
    mockSuccessfulExtract(invoiceService, {
      invoice: { buyerName: "Bayut Web Publishing FZ. LLC", buyerTrn: "104105756100003" },
    });

    const second = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "supplier_invoice")
      .attach("image", samplePngBuffer(), "invoice2.png");

    expect(second.status).toBe(200);
    expect(second.body.customerResolution.status).toBe("matched");
    expect(second.body.customerResolution.id).toBe(first.body.customerResolution.id);

    const customers = await request(app)
      .get("/api/customers")
      .set(authed(token));

    expect(customers.body.customers).toHaveLength(1);
  });

  // Regression test for QA audit BUG-03: partyResolutionService used to do
  // a SELECT (findMatch) then a separate INSERT with no locking and no DB
  // constraint backing it, so near-simultaneous uploads for the same
  // brand-new customer could each pass the pre-check and both insert —
  // confirmed to produce duplicate customer rows under concurrency.
  it("does not create duplicate customers when the same new buyer is uploaded concurrently (BUG-03)", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: { buyerName: "Acme Global FZE", buyerTrn: "123456789012345" },
    });

    const CONCURRENCY = 5;
    await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        request(app)
          .post("/api/upload")
          .set(authed(token))
          .field("document_type", "supplier_invoice")
          .attach("image", samplePngBuffer(), `invoice${i}.png`)
      )
    );

    const customers = await request(app)
      .get("/api/customers")
      .set(authed(token));

    const matches = customers.body.customers.filter(
      (c) => c.trn === "123456789012345"
    );
    expect(matches).toHaveLength(1);
  });

  it("flags the invoice for review (not a 400) when no client_id is given and the buyer can't be identified", async () => {
    const { token } = await registerAndLogin();
    // Default fixture has no buyerName/sellerName at all.
    mockSuccessfulExtract(invoiceService);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "supplier_invoice")
      .attach("image", samplePngBuffer(), "invoice.png");

    expect(res.status).toBe(200);
    expect(res.body.customerResolution.status).toBe("needs_review");
    expect(res.body.invoice.client_id).toBeNull();

    // The invoice itself is still saved, just unlinked, so nothing is lost.
    const listed = await request(app)
      .get(`/api/invoices/${res.body.invoice.id}`)
      .set(authed(token));

    expect(listed.status).toBe(200);
  });

  it("still requires client_id for a Bank Statement upload (no seller/buyer relationship to auto-detect)", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bank_statement")
      .attach("image", samplePngBuffer(), "statement.png");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/client/i);
  });

  it("auto-creates a supplier when no client_id is given and the vendor is identifiable (Bill)", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: {
        sellerName: "ADNOC Distribution",
        trn: "100069993200003",
        phoneNumber: "+97124444444",
        email: "info@adnocdistribution.ae",
        location: "Abu Dhabi, UAE",
      },
    });

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill.png");

    expect(res.status).toBe(200);
    expect(res.body.invoice.clientName).toBe("ADNOC Distribution");
    expect(res.body.customerResolution.status).toBe("created");
    expect(res.body.invoice.client_id).toBe(res.body.customerResolution.id);

    const suppliers = await request(app)
      .get("/api/suppliers")
      .set(authed(token));

    expect(suppliers.body.suppliers).toHaveLength(1);
    expect(suppliers.body.suppliers[0].company_name).toBe("ADNOC Distribution");
    expect(suppliers.body.suppliers[0].trn).toBe("100069993200003");

    // Never linked as a customer — only as a supplier.
    const customers = await request(app)
      .get("/api/customers")
      .set(authed(token));

    expect(customers.body.customers).toHaveLength(0);
  });

  it("auto-matches an existing supplier by TRN, not a duplicate, when bills from the same vendor are uploaded repeatedly", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: { sellerName: "ADNOC Distribution", trn: "100069993200003" },
    });

    const first = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill1.png");

    expect(first.body.customerResolution.status).toBe("created");

    mockSuccessfulExtract(invoiceService, {
      invoice: { sellerName: "ADNOC DISTRIBUTION", trn: "100069993200003" },
    });

    const second = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill2.png");

    expect(second.status).toBe(200);
    expect(second.body.customerResolution.status).toBe("matched");
    expect(second.body.customerResolution.id).toBe(first.body.customerResolution.id);

    const suppliers = await request(app)
      .get("/api/suppliers")
      .set(authed(token));

    expect(suppliers.body.suppliers).toHaveLength(1);
  });

  // Regression test for QA audit BUG-02: partyResolutionService's
  // fallback name matching used to be a bare substring test, which
  // silently attached a bill to an unrelated existing supplier whenever
  // one name was a linguistic substring of another (e.g. "national" is a
  // substring of "international") — with zero indication to the user. A
  // differing TRN on both sides is strong counter-evidence and must
  // create a new supplier, not silently merge into the wrong one.
  it("does not silently merge a bill into an unrelated supplier whose name happens to share a substring (BUG-02)", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: {
        sellerName: "International Trading Company",
        trn: "100000000000001",
      },
    });

    const first = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill1.png");

    expect(first.body.customerResolution.status).toBe("created");

    mockSuccessfulExtract(invoiceService, {
      invoice: {
        sellerName: "National Trading Company",
        trn: "999999999999999",
      },
    });

    const second = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill2.png");

    expect(second.status).toBe(200);
    expect(second.body.customerResolution.status).not.toBe("matched");
    expect(second.body.customerResolution.id).not.toBe(first.body.customerResolution.id);

    const suppliers = await request(app)
      .get("/api/suppliers")
      .set(authed(token));

    expect(suppliers.body.suppliers).toHaveLength(2);
  });

  // A fuzzy name match with no TRN on either side (very common on real
  // invoices) is too weak to trust blindly — must be flagged for a human
  // to confirm, not silently auto-attached.
  it("flags a fuzzy (non-exact) name-only match for review instead of auto-linking it", async () => {
    const { token } = await registerAndLogin();
    // trn: null on both uploads — the default fixture's trn is otherwise
    // identical across calls, which would match via TRN and mask the name
    // matching path this test is isolating.
    mockSuccessfulExtract(invoiceService, {
      invoice: { sellerName: "ABC Trading", trn: null },
    });

    const first = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill1.png");

    expect(first.body.customerResolution.status).toBe("created");

    mockSuccessfulExtract(invoiceService, {
      invoice: { sellerName: "ABC Trading Middle East LLC", trn: null },
    });

    const second = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill2.png");

    expect(second.body.customerResolution.status).toBe("needs_review");
    expect(second.body.invoice.client_id).toBeNull();
  });

  // An exact match (same name, after normalization) with no TRN on either
  // side — the common repeat-vendor case — should still auto-link, not
  // force a review every time.
  it("still auto-links a repeat vendor with no TRN when the name matches exactly", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: { sellerName: "ABC Trading", trn: null },
    });

    const first = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill1.png");

    expect(first.body.customerResolution.status).toBe("created");

    mockSuccessfulExtract(invoiceService, {
      invoice: { sellerName: "ABC Trading", trn: null },
    });

    const second = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bill")
      .attach("image", samplePngBuffer(), "bill2.png");

    expect(second.body.customerResolution.status).toBe("matched");
    expect(second.body.customerResolution.id).toBe(first.body.customerResolution.id);
  });

  // Regression test for QA audit BUG-QA-02: the "exact-name" auto-link tier
  // used to compare names through the SAME legal-suffix-stripping
  // normalization the fuzzy tier uses, so two distinct companies whose
  // names differ only by suffix ("LLC" vs "Group" — both stripped, and
  // "holdings" is itself a stripped suffix) collapsed to the identical
  // string "abc" and were silently auto-linked with no review, exactly the
  // failure mode BUG-02 was meant to close.
  it("does not treat two distinct companies differing only by legal suffix as an exact match (BUG-QA-02)", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtract(invoiceService, {
      invoice: { buyerName: "ABC Holdings LLC", buyerTrn: null },
    });

    const first = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "supplier_invoice")
      .attach("image", samplePngBuffer(), "invoice1.png");

    expect(first.body.customerResolution.status).toBe("created");

    mockSuccessfulExtract(invoiceService, {
      invoice: { buyerName: "ABC Holdings Group", buyerTrn: null },
    });

    const second = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "supplier_invoice")
      .attach("image", samplePngBuffer(), "invoice2.png");

    expect(second.body.customerResolution.status).not.toBe("matched");
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

  // Regression test for QA audit BUG-QA-03: multer's fileFilter only
  // checked the client-supplied multipart Content-Type header, which a
  // spoofed request can set to anything regardless of the file's real
  // bytes — a renamed executable claiming "image/png" uploaded successfully.
  it("rejects a file whose content doesn't match its claimed Content-Type, even though the header alone would pass multer's filter (BUG-QA-03)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    // A Windows PE header ("MZ...") wearing a spoofed image/png Content-Type.
    const fakePng = Buffer.from("MZ\x90\x00\x03\x00\x00\x00not actually a png");

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", fakePng, {
        filename: "resume.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/content/i);
  });

  it("rejects a 0-byte upload", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", Buffer.alloc(0), {
        filename: "empty.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
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

  it("releases the storage quota reserved for a failed upload instead of leaking it (BUG-USAGE-002)", async () => {
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);
    mockExtractionFailure(invoiceService, "Could not read this document.");

    const res = await uploadImage(token, clientId);
    expect(res.status).toBe(400);

    const [[usage]] = await pool.execute(
      `SELECT storage_used FROM usage_stats WHERE user_id = ?`,
      [user.id]
    );

    // The file was rejected and never persisted as an invoice — its bytes
    // must not still be counted against the user's storage quota.
    expect(Number(usage.storage_used)).toBe(0);
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
    const supplierId = await createSupplier(token);
    mockSuccessfulExtract(invoiceService);

    const res = await uploadImage(token, supplierId, "invoice.png", "bill");

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
    const supplierId = await createSupplier(token);

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "supplier.png", "supplier_invoice");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, supplierId, "bill.png", "bill");

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
    const supplierId = await createSupplier(token);
    mockSuccessfulExtract(invoiceService);
    const uploadRes = await uploadImage(token, supplierId, "invoice.png", "bill");
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

  // Regression test for QA audit BUG-06: Gemini's real extraction schema
  // names a line item's total "amount" (services/geminiService.js), never
  // "totalPrice" — invoiceNormalizer.js used to check only `totalPrice`,
  // which was never populated, so it silently discarded the real extracted
  // amount and always recomputed quantity * unitPrice instead. Invisible
  // in the default test fixture only because its amount happens to equal
  // quantity * unitPrice; this test uses a discounted line (amount below
  // qty*unitPrice) to actually exercise the divergence.
  it("persists a line item's real extracted amount, not a recomputed quantity * unitPrice (BUG-06)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtract(invoiceService, {
      invoice: {
        lineItems: [
          { description: "Discounted item", quantity: 10, unitPrice: 10, amount: 90 },
        ],
      },
    });

    const res = await uploadImage(token, clientId);

    expect(res.status).toBe(200);
    const detail = await request(app)
      .get(`/api/invoices/${res.body.invoice.id}`)
      .set(authed(token));

    expect(Number(detail.body.lineItems[0].total_price)).toBe(90);
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

  // Regression test for QA audit BUG-07: a line item edit that sends
  // quantity/unit_price but omits total_price used to silently save
  // total_price as 0 instead of falling back to quantity * unit_price
  // (the same fallback the upload-time normalizer already applies).
  it("falls back to quantity * unit_price when a line item edit omits total_price", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Missing total item", quantity: 5, unit_price: 10 },
        ],
      });

    expect(res.status).toBe(200);
    expect(Number(res.body.lineItems[0].total_price)).toBe(50);
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

  it("rejects an invalid line item edit with a clean 400, without losing the invoice's existing line items", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    // First, a valid edit that replaces the line items with a known one.
    const valid = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Kept item", quantity: 2, unit_price: 15, total_price: 30 },
        ],
      });
    expect(valid.status).toBe(200);

    // Then an edit with an invalid line item value.
    const invalid = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Bad item", quantity: "abc", unit_price: 10, total_price: 10 },
        ],
      });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/invalid value for line item/i);

    // The previously-saved line item must still be there — not silently
    // deleted by the rejected edit (BUG-INVOICE-002).
    const after = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set(authed(token));

    expect(after.body.lineItems).toHaveLength(1);
    expect(after.body.lineItems[0].description).toBe("Kept item");
  });

  it("rejects a negative line item quantity/price", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Negative item", quantity: -5, unit_price: 10, total_price: -50 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid value for line item/i);
  });

  it("rejects an oversized numeric field with a clean 400 instead of a raw MySQL 'out of range' error (BUG-INVOICE-001)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({ subtotal: 99999999999999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid value for subtotal/i);
    expect(res.body.error).not.toMatch(/mysql|out of range|sql/i);
  });

  it("rejects an oversized line item numeric field the same way", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/invoices/${invoice.id}`)
      .set(authed(token))
      .send({
        lineItems: [
          { description: "Huge item", quantity: 99999999999, unit_price: 10, total_price: 10 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid value for line item/i);
    expect(res.body.error).not.toMatch(/mysql|out of range|sql/i);
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

  // Regression test for QA audit BUG-QA-01: invoices.customer_id/supplier_id
  // are ON DELETE CASCADE, so deleting a customer/supplier used to silently
  // destroy every invoice/bill ever issued against them, with no warning.
  it("blocks deleting a customer that still has invoices, instead of silently cascading them away (BUG-QA-01)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId);

    const del = await request(app)
      .delete(`/api/customers/${clientId}`)
      .set(authed(token));

    expect(del.status).toBe(400);
    expect(del.body.error).toMatch(/invoice/i);

    // The customer and its invoice are both still there, untouched.
    const get = await request(app)
      .get(`/api/customers/${clientId}`)
      .set(authed(token));
    expect(get.status).toBe(200);
  });

  it("blocks deleting a supplier that still has bills, instead of silently cascading them away (BUG-QA-01)", async () => {
    const { token } = await registerAndLogin();
    const supplierId = await createSupplier(token);

    mockSuccessfulExtract(invoiceService, { invoice: { sellerName: "Test Supplier" } });
    await uploadImage(token, supplierId, "bill.png", "bill");

    const del = await request(app)
      .delete(`/api/suppliers/${supplierId}`)
      .set(authed(token));

    expect(del.status).toBe(400);
    expect(del.body.error).toMatch(/bill/i);

    const get = await request(app)
      .get(`/api/suppliers/${supplierId}`)
      .set(authed(token));
    expect(get.status).toBe(200);
  });

  it("releases storage quota and deletes the source file when an invoice is deleted (BUG-USAGE-002)", async () => {
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);
    const invoice = await uploadOne(token, clientId);

    const [[before]] = await pool.execute(
      `SELECT image_path, storage_used FROM invoices i
       JOIN usage_stats u ON u.user_id = i.user_id
       WHERE i.id = ?`,
      [invoice.id]
    );

    const storedPath = before.image_path;
    const fullPath = path.join(__dirname, "..", "..", storedPath);

    expect(storedPath).toBeTruthy();
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(Number(before.storage_used)).toBeGreaterThan(0);

    const del = await request(app)
      .delete(`/api/invoices/${invoice.id}`)
      .set(authed(token));
    expect(del.status).toBe(200);

    const [[after]] = await pool.execute(
      `SELECT storage_used FROM usage_stats WHERE user_id = ?`,
      [user.id]
    );

    expect(Number(after.storage_used)).toBe(0);
    expect(fs.existsSync(fullPath)).toBe(false);
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
      `INSERT INTO plans (name, slug, invoice_limit, customer_limit, ocr_limit, storage_limit, user_limit, active)
       VALUES (?, ?, 5, 100, 1000, 5000, 1, 1)`,
      [`Concurrency Test ${user.id}`, `concurrency-test-${user.id}`]
    );
    await pool.execute(
      `UPDATE subscriptions SET plan_id = ? WHERE user_id = ? AND status IN ('active', 'trial')`,
      [planResult.insertId, user.id]
    );

    const companyId = await ownedCompanyId(user.id);

    const agent = new FreeInvoiceAgent();
    const CONCURRENCY = 10;
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        agent.processImage(`/fake/path-${i}.png`, user.id, companyId, clientId)
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

    const companyId = await ownedCompanyId(user.id);

    const agent = new FreeInvoiceAgent();
    const CONCURRENCY = 5;
    const settled = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        agent.processPDF(pdfPath, user.id, companyId, clientId)
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
