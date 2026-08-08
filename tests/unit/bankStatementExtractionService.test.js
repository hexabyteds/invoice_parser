jest.mock("../../services/geminiService");

const fs = require("fs");
const os = require("os");
const path = require("path");

const geminiService = require("../../services/geminiService");
const bankStatementExtractionService = require("../../services/bankStatementExtractionService");
const { samplePdfBuffer } = require("../helpers/fixtures");

function writeTempPdf(name, buffer) {
  const filePath = path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random()}.pdf`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

describe("bankStatementExtractionService.extractPDF", () => {
  let pdfPath;

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES;
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      pdfPath = null;
    }
  });

  it("makes a single Gemini call when pageCount is within the chunk size (2-page statement)", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "6";
    pdfPath = writeTempPdf("bs-single", await samplePdfBuffer(2));

    geminiService.extractBankStatement.mockResolvedValue({
      success: true,
      statement: {
        bankName: "Test Bank", accountTitle: "A", accountNumber: "1", iban: "IB1",
        currency: "AED", fromDate: "2026-01-01", toDate: "2026-01-31",
        openingBalance: 100, closingBalance: 200,
      },
      transactions: [
        {
          transactionDate: "2026-01-02", description: "Deposit", credit: 100, debit: 0,
          availableBalance: 200, referenceNo: "R1",
          continuesFromPreviousChunk: false, continuesToNextChunk: false,
        },
      ],
    });

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.success).toBe(true);
    expect(geminiService.extractBankStatement).toHaveBeenCalledTimes(1);
    expect(result.statement.bankName).toBe("Test Bank");
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("Deposit");
    expect(result.meta.pageCount).toBe(2);
    expect(result.meta.partialFailure).toBe(false);
  });

  it("handles a 1-page statement the same way as any other single-chunk case", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "6";
    pdfPath = writeTempPdf("bs-onepage", await samplePdfBuffer(1));

    geminiService.extractBankStatement.mockResolvedValue({
      success: true,
      statement: {
        bankName: "Solo Bank", accountTitle: "", accountNumber: "", iban: "",
        currency: "AED", fromDate: "2026-02-01", toDate: "2026-02-01",
        openingBalance: 0, closingBalance: 0,
      },
      transactions: [],
    });

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.success).toBe(true);
    expect(geminiService.extractBankStatement).toHaveBeenCalledTimes(1);
    expect(result.transactions).toHaveLength(0);
    expect(result.meta.pageCount).toBe(1);
  });

  it("processes a 100+ page statement across many chunks and merges them into one statement", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "20";
    pdfPath = writeTempPdf("bs-large", await samplePdfBuffer(120));

    geminiService.extractBankStatement.mockImplementation(async () => ({
      success: true,
      statement: {
        bankName: "Big Bank", accountTitle: "", accountNumber: "", iban: "",
        currency: "AED", fromDate: "", toDate: "", openingBalance: 0, closingBalance: 0,
      },
      transactions: [
        {
          transactionDate: "2026-03-01", description: "Row", credit: 10, debit: 0,
          availableBalance: 10, referenceNo: "",
          continuesFromPreviousChunk: false, continuesToNextChunk: false,
        },
      ],
    }));

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.success).toBe(true);
    expect(geminiService.extractBankStatement).toHaveBeenCalledTimes(6); // 120 / 20
    expect(result.meta.pageCount).toBe(120);
    expect(result.meta.geminiRequests).toBe(6);
    // one transaction per chunk, none of them flagged as continuations
    expect(result.transactions).toHaveLength(6);
  });

  it("stitches a transaction whose description/amounts are split across a chunk boundary into one row", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "1"; // force each page into its own chunk
    pdfPath = writeTempPdf("bs-boundary", await samplePdfBuffer(2));

    geminiService.extractBankStatement
      .mockResolvedValueOnce({
        success: true,
        statement: {
          bankName: "Test Bank", accountTitle: "", accountNumber: "", iban: "",
          currency: "AED", fromDate: "2026-01-01", toDate: "", openingBalance: 100, closingBalance: 0,
        },
        transactions: [
          {
            transactionDate: "2026-01-02",
            description: "Money Received from SYED MANZAR",
            credit: 0, debit: 0, availableBalance: 0, referenceNo: "",
            continuesFromPreviousChunk: false, continuesToNextChunk: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        statement: {
          bankName: "", accountTitle: "", accountNumber: "", iban: "",
          currency: "", fromDate: "", toDate: "2026-01-31", openingBalance: 0, closingBalance: 500,
        },
        transactions: [
          {
            transactionDate: "",
            description: "ABBAS via transfer STAN (000123)",
            credit: 3500, debit: 0, availableBalance: 4500, referenceNo: "STAN000123",
            continuesFromPreviousChunk: true, continuesToNextChunk: false,
          },
        ],
      });

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.success).toBe(true);
    expect(geminiService.extractBankStatement).toHaveBeenCalledTimes(2);

    // The two fragments must merge into exactly ONE transaction, not two.
    expect(result.transactions).toHaveLength(1);

    const merged = result.transactions[0];
    expect(merged.description).toBe(
      "Money Received from SYED MANZAR ABBAS via transfer STAN (000123)"
    );
    expect(merged.transactionDate).toBe("2026-01-02");
    expect(merged.credit).toBe(3500);
    expect(merged.debit).toBe(0);
    expect(merged.availableBalance).toBe(4500);
    expect(merged.referenceNo).toBe("STAN000123");

    // Statement-level merge: bankName/openingBalance/fromDate come from the
    // first chunk, closingBalance/toDate from the last.
    expect(result.statement.bankName).toBe("Test Bank");
    expect(result.statement.openingBalance).toBe(100);
    expect(result.statement.fromDate).toBe("2026-01-01");
    expect(result.statement.closingBalance).toBe(500);
    expect(result.statement.toDate).toBe("2026-01-31");
  });

  it("does NOT merge two adjacent transactions when neither continuation flag is set", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "1";
    pdfPath = writeTempPdf("bs-no-merge", await samplePdfBuffer(2));

    geminiService.extractBankStatement
      .mockResolvedValueOnce({
        success: true,
        statement: {
          bankName: "Test Bank", accountTitle: "", accountNumber: "", iban: "",
          currency: "AED", fromDate: "2026-01-01", toDate: "", openingBalance: 100, closingBalance: 0,
        },
        transactions: [
          {
            transactionDate: "2026-01-02", description: "Deposit", credit: 100, debit: 0,
            availableBalance: 200, referenceNo: "",
            continuesFromPreviousChunk: false, continuesToNextChunk: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        statement: {
          bankName: "", accountTitle: "", accountNumber: "", iban: "",
          currency: "", fromDate: "", toDate: "2026-01-31", openingBalance: 0, closingBalance: 150,
        },
        transactions: [
          {
            transactionDate: "2026-01-05", description: "ATM Withdrawal", credit: 0, debit: 50,
            availableBalance: 150, referenceNo: "",
            continuesFromPreviousChunk: false, continuesToNextChunk: false,
          },
        ],
      });

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((t) => t.description)).toEqual([
      "Deposit",
      "ATM Withdrawal",
    ]);
  });

  it("keeps successfully-extracted transactions and reports a partial failure when one chunk fails", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "1";
    pdfPath = writeTempPdf("bs-partial", await samplePdfBuffer(2));

    geminiService.extractBankStatement
      .mockResolvedValueOnce({
        success: true,
        statement: {
          bankName: "Test Bank", accountTitle: "", accountNumber: "", iban: "",
          currency: "AED", fromDate: "2026-01-01", toDate: "2026-01-31",
          openingBalance: 100, closingBalance: 100,
        },
        transactions: [
          {
            transactionDate: "2026-01-02", description: "Deposit", credit: 100, debit: 0,
            availableBalance: 200, referenceNo: "",
            continuesFromPreviousChunk: false, continuesToNextChunk: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        success: false,
        error: "Gemini timed out.",
      });

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.meta.partialFailure).toBe(true);
    expect(result.meta.failedChunks).toBe(1);
    expect(result.meta.successfulChunks).toBe(1);
  });

  it("returns success:false with no transactions when every chunk fails (invalid/corrupted PDF)", async () => {
    process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES = "6";
    pdfPath = writeTempPdf("bs-total-fail", await samplePdfBuffer(1));

    geminiService.extractBankStatement.mockResolvedValue({
      success: false,
      error: "Corrupted PDF.",
    });

    const result = await bankStatementExtractionService.extractPDF(pdfPath);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/corrupted/i);
    expect(result.meta.partialFailure).toBe(false);
    expect(result.meta.successfulChunks).toBe(0);
  });
});
