jest.mock("../../services/invoiceService");
jest.mock("../../services/bankStatementExtractionService");

const invoiceService = require("../../services/invoiceService");
const bankStatementExtractionService = require("../../services/bankStatementExtractionService");
const { request, app, registerAndLogin, authed } = require("../helpers/api");
const {
  mockSuccessfulExtract,
  mockExtractionFailure,
} = require("../mocks/invoiceService.mock");
const { mockSuccessfulExtractImage } = require("../mocks/bankStatementExtraction.mock");
const { samplePngBuffer } = require("../helpers/fixtures");

async function createClient(token, name) {
  const res = await request(app)
    .post("/api/clients")
    .set(authed(token))
    .send({ company_name: name });
  return res.body.client.id;
}

function uploadImage(token, clientId, documentType) {
  const req = request(app)
    .post("/api/upload")
    .set(authed(token))
    .field("client_id", String(clientId));

  if (documentType) {
    req.field("document_type", documentType);
  }

  return req.attach("image", samplePngBuffer(), "invoice.png");
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Dashboard analytics endpoints", () => {
  it("requires authentication on every dashboard route", async () => {
    const paths = [
      "/api/dashboard/summary",
      "/api/dashboard/monthly",
      "/api/dashboard/top-clients",
      "/api/dashboard/confidence-distribution",
      "/api/dashboard/quality",
      "/api/dashboard/client-analytics",
      "/api/dashboard/activity",
    ];

    for (const path of paths) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it("reflects one successful, one rejected, and one errored upload across two clients", async () => {
    const { token } = await registerAndLogin();
    const clientA = await createClient(token, "Client A");
    const clientB = await createClient(token, "Client B");

    // Successful extraction for Client A
    mockSuccessfulExtract(invoiceService);
    const okRes = await uploadImage(token, clientA);
    expect(okRes.status).toBe(200);

    // Gemini extracted something, but it fails the validation gate (Client A)
    mockSuccessfulExtract(invoiceService, {
      validation: { isValid: false, errors: ["Missing vendor/client name"] },
    });
    const rejectedRes = await uploadImage(token, clientA);
    expect(rejectedRes.status).toBe(400);

    // Hard extraction/OCR failure (Client B)
    mockExtractionFailure(invoiceService);
    const errorRes = await uploadImage(token, clientB);
    expect(errorRes.status).toBe(400);

    // ---- summary ----
    const summaryRes = await request(app)
      .get("/api/dashboard/summary")
      .set(authed(token));
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.summary.totalInvoices.value).toBe(1);
    expect(summaryRes.body.summary.totalClients.value).toBe(2);
    expect(summaryRes.body.summary.totalExpenses.value).toBeGreaterThan(0);

    // ---- monthly (12 months, current month reflects this run) ----
    const monthlyRes = await request(app)
      .get("/api/dashboard/monthly")
      .set(authed(token));
    expect(monthlyRes.status).toBe(200);
    expect(monthlyRes.body.monthly.invoices).toHaveLength(12);
    const currentMonth =
      monthlyRes.body.monthly.invoices[monthlyRes.body.monthly.invoices.length - 1];
    expect(currentMonth.processed).toBe(1);
    expect(currentMonth.failed).toBe(2);
    expect(currentMonth.uploaded).toBe(3);

    // ---- top clients (only clients with >=1 successful invoice) ----
    const topClientsRes = await request(app)
      .get("/api/dashboard/top-clients")
      .set(authed(token));
    expect(topClientsRes.status).toBe(200);
    expect(topClientsRes.body.topClients).toHaveLength(1);
    expect(topClientsRes.body.topClients[0].companyName).toBe("Client A");
    expect(topClientsRes.body.topClients[0].invoiceCount).toBe(1);

    // ---- confidence distribution (1 successfully persisted invoice) ----
    const confRes = await request(app)
      .get("/api/dashboard/confidence-distribution")
      .set(authed(token));
    expect(confRes.status).toBe(200);
    const { high, medium, low } = confRes.body.distribution;
    expect(high + medium + low).toBe(1);

    // ---- quality (needs attention + accuracy) ----
    const qualityRes = await request(app)
      .get("/api/dashboard/quality")
      .set(authed(token));
    expect(qualityRes.status).toBe(200);
    expect(qualityRes.body.needsAttention.failedInvoices).toBe(1);
    expect(qualityRes.body.needsAttention.processingErrors).toBe(1);
    expect(qualityRes.body.needsAttention.pendingOCR).toBe(0);
    expect(qualityRes.body.accuracy.totalSuccessfullyExtracted).toBe(1);

    // ---- per-client analytics ----
    const clientAnalyticsRes = await request(app)
      .get("/api/dashboard/client-analytics")
      .set(authed(token));
    expect(clientAnalyticsRes.status).toBe(200);
    const rowA = clientAnalyticsRes.body.clients.find((c) => c.companyName === "Client A");
    const rowB = clientAnalyticsRes.body.clients.find((c) => c.companyName === "Client B");
    expect(rowA).toMatchObject({ uploaded: 2, processed: 1, failed: 1 });
    expect(rowB).toMatchObject({ uploaded: 1, processed: 0, failed: 1 });

    // ---- activity feed ----
    const activityRes = await request(app)
      .get("/api/dashboard/activity")
      .set(authed(token));
    expect(activityRes.status).toBe(200);
    const actions = activityRes.body.activity.map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "client_added",
        "invoice_uploaded",
        "invoice_processed",
        "invoice_rejected",
        "invoice_error",
      ])
    );
  });

  it("keeps each user's dashboard data isolated from other users", async () => {
    const { token: tokenA } = await registerAndLogin();
    const { token: tokenB } = await registerAndLogin();

    await createClient(tokenA, "Only Seen By A");

    const summaryB = await request(app)
      .get("/api/dashboard/summary")
      .set(authed(tokenB));

    expect(summaryB.body.summary.totalClients.value).toBe(0);

    const clientAnalyticsB = await request(app)
      .get("/api/dashboard/client-analytics")
      .set(authed(tokenB));

    expect(clientAnalyticsB.body.clients).toHaveLength(0);
  });

  it("scopes summary/monthly/confidence/quality to a single client via ?client_id", async () => {
    const { token } = await registerAndLogin();
    const clientA = await createClient(token, "Client A");
    const clientB = await createClient(token, "Client B");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientA);

    mockExtractionFailure(invoiceService);
    await uploadImage(token, clientB);

    const summaryA = await request(app)
      .get("/api/dashboard/summary")
      .query({ client_id: clientA })
      .set(authed(token));

    expect(summaryA.body.summary.totalInvoices.value).toBe(1);
    expect(summaryA.body.summary.totalClients).toBeUndefined();

    const summaryB = await request(app)
      .get("/api/dashboard/summary")
      .query({ client_id: clientB })
      .set(authed(token));

    expect(summaryB.body.summary.totalInvoices.value).toBe(0);

    const qualityB = await request(app)
      .get("/api/dashboard/quality")
      .query({ client_id: clientB })
      .set(authed(token));

    expect(qualityB.body.needsAttention.processingErrors).toBe(1);
    expect(qualityB.body.needsAttention.failedInvoices).toBe(0);

    const confidenceA = await request(app)
      .get("/api/dashboard/confidence-distribution")
      .query({ client_id: clientA })
      .set(authed(token));

    expect(
      confidenceA.body.distribution.high +
        confidenceA.body.distribution.medium +
        confidenceA.body.distribution.low
    ).toBe(1);

    const monthlyA = await request(app)
      .get("/api/dashboard/monthly")
      .query({ client_id: clientA })
      .set(authed(token));

    const currentMonthA =
      monthlyA.body.monthly.invoices[monthlyA.body.monthly.invoices.length - 1];
    expect(currentMonthA.processed).toBe(1);
    expect(currentMonthA.failed).toBe(0);
  });
});

describe("Dashboard document-type breakdown", () => {
  it("counts supplier invoices, bills, and uncategorized documents from the database", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token, "Client A");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "supplier_invoice");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "supplier_invoice");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "bill");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId); // no type selected

    const res = await request(app)
      .get("/api/dashboard/document-types")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      supplierInvoices: 2,
      bills: 1,
      bankStatements: 0,
      uncategorized: 1,
      total: 4,
    });
  });

  it("scopes document-type counts to a single client when client_id is given", async () => {
    const { token } = await registerAndLogin();
    const clientA = await createClient(token, "Client A");
    const clientB = await createClient(token, "Client B");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientA, "bill");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientB, "supplier_invoice");

    const res = await request(app)
      .get("/api/dashboard/document-types")
      .query({ client_id: clientA })
      .set(authed(token));

    expect(res.body.counts).toEqual({
      supplierInvoices: 0,
      bills: 1,
      bankStatements: 0,
      uncategorized: 0,
      total: 1,
    });
  });

  it("counts a bank statement in its own bucket, not uncategorized", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token, "Client A");

    mockSuccessfulExtract(invoiceService);
    await uploadImage(token, clientId, "bill");

    mockSuccessfulExtractImage(bankStatementExtractionService);
    await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .field("document_type", "bank_statement")
      .attach("image", samplePngBuffer(), "statement.png");

    const res = await request(app)
      .get("/api/dashboard/document-types")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      supplierInvoices: 0,
      bills: 1,
      bankStatements: 1,
      uncategorized: 0,
      total: 2,
    });
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/dashboard/document-types");
    expect(res.status).toBe(401);
  });
});

describe("Dashboard summary filtered by document_type", () => {
  it("scopes the summary KPIs to a single document type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token, "Client A");

    mockSuccessfulExtract(invoiceService, { invoice: { totalAmount: 100 } });
    await uploadImage(token, clientId, "supplier_invoice");

    mockSuccessfulExtract(invoiceService, { invoice: { totalAmount: 250 } });
    await uploadImage(token, clientId, "bill");

    const supplierRes = await request(app)
      .get("/api/dashboard/summary")
      .query({ document_type: "supplier_invoice" })
      .set(authed(token));

    expect(supplierRes.status).toBe(200);
    expect(supplierRes.body.summary.totalInvoices.value).toBe(1);
    expect(supplierRes.body.summary.totalExpenses.value).toBe(100);

    const billRes = await request(app)
      .get("/api/dashboard/summary")
      .query({ document_type: "bill" })
      .set(authed(token));

    expect(billRes.status).toBe(200);
    expect(billRes.body.summary.totalInvoices.value).toBe(1);
    expect(billRes.body.summary.totalExpenses.value).toBe(250);

    const allRes = await request(app)
      .get("/api/dashboard/summary")
      .set(authed(token));

    expect(allRes.body.summary.totalInvoices.value).toBe(2);
  });

  it("rejects an invalid document_type on the summary endpoint", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/dashboard/summary")
      .query({ document_type: "nonsense" })
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
