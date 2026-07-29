const {
  sampleParsedInvoice,
  sampleValidation,
} = require("../helpers/fixtures");

// Call `jest.mock("../../services/invoiceService")` at the TOP of the test
// file first (Jest hoists it) so `invoiceService.extract`/`extractPDF` are
// auto-mocked jest.fn()s, then use these helpers to configure a scenario.

function mockSuccessfulExtract(invoiceService, overrides = {}) {
  invoiceService.extract.mockResolvedValue({
    success: true,
    invoice: sampleParsedInvoice(overrides.invoice),
    validation: sampleValidation(overrides.validation),
  });
}

function mockSuccessfulExtractPDF(invoiceService, overrides = {}) {
  invoiceService.extractPDF.mockResolvedValue({
    success: true,
    invoices: [
      {
        invoice: sampleParsedInvoice(overrides.invoice),
        validation: sampleValidation(overrides.validation),
        pageIndex: 0,
      },
    ],
    meta: { pageCount: 1, geminiRequests: 1 },
  });
}

function mockExtractionFailure(invoiceService, message = "Gemini could not read this document.") {
  invoiceService.extract.mockResolvedValue({ success: false, error: message });
  invoiceService.extractPDF.mockResolvedValue({ success: false, error: message });
}

module.exports = {
  mockSuccessfulExtract,
  mockSuccessfulExtractPDF,
  mockExtractionFailure,
};
