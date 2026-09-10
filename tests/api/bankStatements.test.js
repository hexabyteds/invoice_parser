jest.mock("../../services/bankStatementExtractionService");

const bankStatementExtractionService = require("../../services/bankStatementExtractionService");
const pool = require("../../config/database");
const { request, app, registerAndLogin, authed } = require("../helpers/api");
const {
  mockSuccessfulExtractImage,
  mockSuccessfulExtractPDF,
  mockExtractionFailure,
} = require("../mocks/bankStatementExtraction.mock");
const { samplePngBuffer, samplePdfBuffer, sampleTransaction } = require("../helpers/fixtures");

async function createClient(token, name = "Bank Statement Client") {
  const res = await request(app)
    .post("/api/customers")
    .set(authed(token))
    .send({ company_name: name });
  return res.body.customer.id;
}

function uploadBankStatement(token, clientId, filename = "statement.png") {
  return request(app)
    .post("/api/upload")
    .set(authed(token))
    .field("client_id", String(clientId))
    .field("document_type", "bank_statement")
    .attach("image", samplePngBuffer(), filename);
}

async function uploadBankStatementPdf(token, clientId, pageCount = 1, filename = "statement.pdf") {
  const pdf = await samplePdfBuffer(pageCount);
  return request(app)
    .post("/api/upload")
    .set(authed(token))
    .field("client_id", String(clientId))
    .field("document_type", "bank_statement")
    .attach("image", pdf, filename);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Bank statement upload (Gemini mocked)", () => {
  it("uploads and processes an image bank statement", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractImage(bankStatementExtractionService);

    const res = await uploadBankStatement(token, clientId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bankStatement.bankName).toBe("Emirates Test Bank");
    expect(res.body.transactionCount).toBe(1);
  });

  it("uploads and processes a multi-page PDF bank statement", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractPDF(bankStatementExtractionService, { pageCount: 2 });

    const res = await uploadBankStatementPdf(token, clientId, 2);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bankStatement.pageCount).toBe(2);
    expect(res.body.transactionCount).toBe(2);
  });

  it("handles a 1-page bank statement", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractPDF(bankStatementExtractionService, { pageCount: 1 });

    const res = await uploadBankStatementPdf(token, clientId, 1);

    expect(res.status).toBe(200);
    expect(res.body.bankStatement.pageCount).toBe(1);
  });

  it("preserves a credit transaction, a debit transaction, and a multi-line description as one row", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtractPDF(bankStatementExtractionService, {
      transactions: [
        sampleTransaction({
          description: "Money Received from SYED MANZAR ABBAS via transfer STAN (000123)",
          credit: 3500,
          debit: 0,
        }),
        sampleTransaction({
          description: "ATM Withdrawal",
          credit: 0,
          debit: 500,
          transactionDate: "2026-01-03",
        }),
      ],
    });

    const uploadRes = await uploadBankStatementPdf(token, clientId, 1);
    const statementId = uploadRes.body.bankStatement.id;

    const txRes = await request(app)
      .get(`/api/bank-statements/${statementId}/transactions`)
      .set(authed(token));

    expect(txRes.status).toBe(200);
    expect(txRes.body.transactions).toHaveLength(2);

    const credit = txRes.body.transactions.find((t) => Number(t.credit) > 0);
    const debit = txRes.body.transactions.find((t) => Number(t.debit) > 0);

    expect(credit.description).toBe(
      "Money Received from SYED MANZAR ABBAS via transfer STAN (000123)"
    );
    expect(Number(credit.debit)).toBe(0);
    expect(Number(debit.credit)).toBe(0);
    expect(Number(debit.debit)).toBe(500);
  });

  it("stores neither-credit-nor-debit transactions with both fields as 0, not invented amounts", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtractPDF(bankStatementExtractionService, {
      transactions: [
        sampleTransaction({ description: "Fee reversal (unclear)", credit: 0, debit: 0 }),
      ],
    });

    const uploadRes = await uploadBankStatementPdf(token, clientId, 1);
    const statementId = uploadRes.body.bankStatement.id;

    const txRes = await request(app)
      .get(`/api/bank-statements/${statementId}/transactions`)
      .set(authed(token));

    expect(Number(txRes.body.transactions[0].credit)).toBe(0);
    expect(Number(txRes.body.transactions[0].debit)).toBe(0);
  });

  it("handles a different statement currency", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtractImage(bankStatementExtractionService, {
      statement: { currency: "USD" },
    });

    const res = await uploadBankStatement(token, clientId);

    expect(res.body.bankStatement.currency).toBe("USD");
  });

  it("preserves missing optional account info as null rather than inventing values", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtractImage(bankStatementExtractionService, {
      statement: { iban: "", accountTitle: "" },
    });

    const res = await uploadBankStatement(token, clientId);

    expect(res.body.bankStatement.iban).toBeNull();
    expect(res.body.bankStatement.accountTitle).toBeNull();
  });

  it("surfaces an extraction failure as a clean 400, not a 500 crash", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockExtractionFailure(bankStatementExtractionService, "Could not read this bank statement.");

    const res = await uploadBankStatement(token, clientId);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects upload with no client_id", async () => {
    const { token } = await registerAndLogin();
    mockSuccessfulExtractImage(bankStatementExtractionService);

    const res = await request(app)
      .post("/api/upload")
      .set(authed(token))
      .field("document_type", "bank_statement")
      .attach("image", samplePngBuffer(), "statement.png");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/client/i);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/upload")
      .field("client_id", "1")
      .field("document_type", "bank_statement")
      .attach("image", samplePngBuffer(), "statement.png");

    expect(res.status).toBe(401);
  });

  it("does not increment invoices_used, but does increment bank_statements_used and ocr_pages_used", async () => {
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractPDF(bankStatementExtractionService, { pageCount: 3 });

    await uploadBankStatementPdf(token, clientId, 3);

    const [rows] = await pool.execute(
      `SELECT invoices_used, bank_statements_used, ocr_pages_used FROM usage_stats WHERE user_id = ?`,
      [user.id]
    );

    expect(rows[0].invoices_used).toBe(0);
    expect(rows[0].bank_statements_used).toBe(1);
    expect(rows[0].ocr_pages_used).toBe(3);
  });
});

describe("Bank statement retrieval + transactions", () => {
  async function uploadOne(token, clientId, transactions) {
    mockSuccessfulExtractPDF(bankStatementExtractionService, {
      transactions: transactions || [
        sampleTransaction({ transactionDate: "2026-01-02", description: "Deposit", credit: 100, debit: 0 }),
        sampleTransaction({ transactionDate: "2026-01-05", description: "ATM Withdrawal", credit: 0, debit: 50 }),
        sampleTransaction({ transactionDate: "2026-01-05", description: "POS Payment", credit: 0, debit: 25 }),
      ],
    });
    const res = await uploadBankStatementPdf(token, clientId, 1);
    return res.body.bankStatement;
  }

  it("gets a single bank statement with a transaction count", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}`)
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.bankStatement.transactionCount).toBe(3);
  });

  it("returns 404 for an unknown bank statement id", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get(`/api/bank-statements/999999`)
      .set(authed(token));

    expect(res.status).toBe(404);
  });

  it("paginates transactions", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?page=1&pageSize=2`)
      .set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ total: 3, page: 1, pageSize: 2, hasMore: true });
  });

  it("sorts transactions by date", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?sortBy=transaction_date&sortDir=desc`)
      .set(authed(token));

    const dates = res.body.transactions.map((t) => t.transactionDate);
    expect(dates[0] >= dates[dates.length - 1]).toBe(true);
  });

  it("filters transactions by hasDebit", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?hasDebit=true`)
      .set(authed(token));

    expect(res.body.pagination.total).toBe(2);
    expect(res.body.transactions.every((t) => Number(t.debit) > 0)).toBe(true);
  });

  it("filters transactions by date range", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?from=2026-01-05&to=2026-01-05`)
      .set(authed(token));

    expect(res.body.pagination.total).toBe(2);
  });

  it("searches transaction descriptions", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?search=ATM`)
      .set(authed(token));

    expect(res.body.pagination.total).toBe(1);
    expect(res.body.transactions[0].description).toMatch(/ATM/);
  });

  it("handles multiple transactions on the same date without collapsing them", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?from=2026-01-05&to=2026-01-05`)
      .set(authed(token));

    expect(res.body.transactions).toHaveLength(2);
  });

  it("handles a very large transaction count with pagination", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    const manyTransactions = Array.from({ length: 250 }, (_, i) =>
      sampleTransaction({
        transactionDate: "2026-01-01",
        description: `Transaction ${i}`,
        credit: i % 2 === 0 ? 10 : 0,
        debit: i % 2 === 0 ? 0 : 10,
      })
    );

    mockSuccessfulExtractPDF(bankStatementExtractionService, { transactions: manyTransactions });
    const uploadRes = await uploadBankStatementPdf(token, clientId, 1);
    const statementId = uploadRes.body.bankStatement.id;

    const firstPage = await request(app)
      .get(`/api/bank-statements/${statementId}/transactions?page=1&pageSize=100`)
      .set(authed(token));

    expect(firstPage.body.pagination.total).toBe(250);
    expect(firstPage.body.transactions).toHaveLength(100);
    expect(firstPage.body.pagination.hasMore).toBe(true);

    const lastPage = await request(app)
      .get(`/api/bank-statements/${statementId}/transactions?page=3&pageSize=100`)
      .set(authed(token));

    expect(lastPage.body.transactions).toHaveLength(50);
    expect(lastPage.body.pagination.hasMore).toBe(false);
  });

  it("rejects a pageSize above the server-side cap", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions?pageSize=1000`)
      .set(authed(token));

    expect(res.status).toBe(400);
  });
});

describe("Bank statement update/delete", () => {
  async function uploadOne(token, clientId) {
    mockSuccessfulExtractPDF(bankStatementExtractionService);
    const res = await uploadBankStatementPdf(token, clientId, 1);
    return res.body.bankStatement;
  }

  it("updates statement-level fields", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const res = await request(app)
      .put(`/api/bank-statements/${statement.id}`)
      .set(authed(token))
      .send({ bankName: "Renamed Bank", accountTitle: "New Title" });

    expect(res.status).toBe(200);
    expect(res.body.bankStatement.bankName).toBe("Renamed Bank");
    expect(res.body.bankStatement.accountTitle).toBe("New Title");
  });

  it("deletes a bank statement and cascades its transactions", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    const statement = await uploadOne(token, clientId);

    const del = await request(app)
      .delete(`/api/bank-statements/${statement.id}`)
      .set(authed(token));

    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/api/bank-statements/${statement.id}`)
      .set(authed(token));
    expect(get.status).toBe(404);

    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS c FROM bank_statement_transactions WHERE bank_statement_id = ?`,
      [statement.id]
    );
    expect(rows[0].c).toBe(0);
  });
});

describe("Bank statement cross-user isolation (IDOR)", () => {
  async function uploadOne(token, clientId) {
    mockSuccessfulExtractPDF(bankStatementExtractionService);
    const res = await uploadBankStatementPdf(token, clientId, 1);
    return res.body.bankStatement;
  }

  it("blocks user B from reading user A's bank statement", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const statement = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}`)
      .set(authed(userB.token));

    expect(res.status).toBe(404);
  });

  it("blocks user B from reading user A's transactions", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const statement = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/transactions`)
      .set(authed(userB.token));

    expect(res.status).toBe(404);
  });

  it("blocks user B from the source file", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const statement = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .get(`/api/bank-statements/${statement.id}/source`)
      .set(authed(userB.token));

    expect(res.status).toBe(404);
  });

  it("blocks user B from updating user A's bank statement", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const statement = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .put(`/api/bank-statements/${statement.id}`)
      .set(authed(userB.token))
      .send({ bankName: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("blocks user B from deleting user A's bank statement", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const clientId = await createClient(userA.token);
    const statement = await uploadOne(userA.token, clientId);

    const res = await request(app)
      .delete(`/api/bank-statements/${statement.id}`)
      .set(authed(userB.token));

    expect(res.status).toBe(404);

    const stillThere = await request(app)
      .get(`/api/bank-statements/${statement.id}`)
      .set(authed(userA.token));
    expect(stillThere.status).toBe(200);
  });
});

describe("Unified documents list includes bank statements", () => {
  it("lists bank statements alongside invoices and filters by document_type", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtractPDF(bankStatementExtractionService);
    await uploadBankStatementPdf(token, clientId, 1);

    const allRes = await request(app).get("/api/documents").set(authed(token));
    expect(allRes.status).toBe(200);
    expect(allRes.body.documents.some((d) => d.documentType === "bank_statement")).toBe(true);

    const filteredRes = await request(app)
      .get("/api/documents?document_type=bank_statement")
      .set(authed(token));
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.documents.every((d) => d.documentType === "bank_statement")).toBe(true);
    expect(filteredRes.body.documents.length).toBeGreaterThan(0);
  });

  it("does not count bank statements in GET /api/invoices", async () => {
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);

    mockSuccessfulExtractPDF(bankStatementExtractionService);
    await uploadBankStatementPdf(token, clientId, 1);

    const res = await request(app).get("/api/invoices").set(authed(token));

    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(0);
  });

  it("rejects bank_statement as a document_type filter on GET /api/invoices", async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .get("/api/invoices?document_type=bank_statement")
      .set(authed(token));

    expect(res.status).toBe(400);
  });
});

describe("Bank statement plan limits", () => {
  it("bank statement uploads are still blocked once the OCR page limit is reached", async () => {
    // Seeded Free plan: ocr_limit 5 (tests/setup/globalSetup.js).
    const { token } = await registerAndLogin();
    const clientId = await createClient(token);
    mockSuccessfulExtractPDF(bankStatementExtractionService, { pageCount: 6 });

    const res = await uploadBankStatementPdf(token, clientId, 6);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/limit reached/i);
  });

  it("bank statement uploads never touch the invoice_limit even at its ceiling", async () => {
    // Seeded Free plan: invoice_limit 5, ocr_limit 5 — give this user a
    // generous OCR budget so invoice_limit (or its absence, for bank
    // statements) is unambiguously the only thing under test here.
    const { token, user } = await registerAndLogin();
    const clientId = await createClient(token);

    const [planResult] = await pool.execute(
      `INSERT INTO plans (name, slug, invoice_limit, customer_limit, ocr_limit, storage_limit, user_limit, active)
       VALUES (?, ?, 5, 100, 1000, 5000, 1, 1)`,
      [`BS Limit Test ${user.id}`, `bs-limit-test-${user.id}`]
    );
    await pool.execute(
      `UPDATE subscriptions SET plan_id = ? WHERE user_id = ? AND status IN ('active', 'trial')`,
      [planResult.insertId, user.id]
    );

    for (let i = 0; i < 6; i++) {
      mockSuccessfulExtractImage(bankStatementExtractionService);
      const res = await uploadBankStatement(token, clientId, `statement-${i}.png`);
      expect(res.status).toBe(200);
    }

    const [rows] = await pool.execute(
      `SELECT invoices_used, bank_statements_used FROM usage_stats WHERE user_id = ?`,
      [user.id]
    );
    expect(rows[0].invoices_used).toBe(0);
    expect(rows[0].bank_statements_used).toBe(6);
  });
});
