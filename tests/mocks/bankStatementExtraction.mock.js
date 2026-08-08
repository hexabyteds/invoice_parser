const {
  sampleBankStatement,
  sampleTransaction,
} = require("../helpers/fixtures");

// Call `jest.mock("../../services/bankStatementExtractionService")` at the
// TOP of the test file first (Jest hoists it) so extractImage/extractPDF
// are auto-mocked jest.fn()s, then use these helpers to configure a
// scenario — mirrors tests/mocks/invoiceService.mock.js.

function mockSuccessfulExtractImage(bankStatementExtractionService, overrides = {}) {
  bankStatementExtractionService.extractImage.mockResolvedValue({
    success: true,
    statement: sampleBankStatement(overrides.statement),
    transactions: overrides.transactions || [sampleTransaction()],
  });
}

function mockSuccessfulExtractPDF(bankStatementExtractionService, overrides = {}) {
  bankStatementExtractionService.extractPDF.mockResolvedValue({
    success: true,
    statement: sampleBankStatement(overrides.statement),
    transactions: overrides.transactions || [
      sampleTransaction(),
      sampleTransaction({
        transactionDate: "2026-01-05",
        description: "ATM Withdrawal",
        credit: 0,
        debit: 500,
        availableBalance: 4000,
        referenceNo: null,
      }),
    ],
    errors: overrides.errors || [],
    meta: overrides.meta || {
      pageCount: overrides.pageCount || 1,
      geminiRequests: 1,
      successfulChunks: 1,
      failedChunks: 0,
      partialFailure: false,
    },
  });
}

function mockExtractionFailure(
  bankStatementExtractionService,
  message = "Gemini could not read this bank statement."
) {
  bankStatementExtractionService.extractImage.mockResolvedValue({
    success: false,
    error: message,
  });
  bankStatementExtractionService.extractPDF.mockResolvedValue({
    success: false,
    error: message,
    errors: [{ chunk: 1, pageStart: 1, pageEnd: 1, error: message }],
    meta: {
      pageCount: 1,
      geminiRequests: 1,
      successfulChunks: 0,
      failedChunks: 1,
      partialFailure: false,
    },
  });
}

module.exports = {
  mockSuccessfulExtractImage,
  mockSuccessfulExtractPDF,
  mockExtractionFailure,
};
