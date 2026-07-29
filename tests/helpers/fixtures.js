const { PDFDocument } = require("pdf-lib");

// A minimal valid 1x1 transparent PNG — good enough for multer's file-type
// filter and for image upload tests, since actual image parsing only
// happens through the mocked invoiceService.extract().
const PNG_1PX_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function samplePngBuffer() {
  return Buffer.from(PNG_1PX_BASE64, "base64");
}

async function samplePdfBuffer(pageCount = 1) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([200, 200]);
  }
  return Buffer.from(await pdf.save());
}

function sampleParsedInvoice(overrides = {}) {
  return {
    invoiceType: "Invoice",
    clientName: "Acme Supplies LLC",
    invoiceNo: "INV-1001",
    invoiceDate: "2026-07-01",
    dueDate: "2026-07-15",
    phoneNumber: "+971500000000",
    location: "Dubai, UAE",
    description: "Office supplies",
    subtotal: 100,
    vatRate: 5,
    vatAmount: 5,
    totalAmount: 105,
    currency: "AED",
    trn: "100123456700003",
    lineItems: [
      { description: "Paper A4", quantity: 10, unitPrice: 5, amount: 50 },
      { description: "Pens", quantity: 20, unitPrice: 2.5, amount: 50 },
    ],
    ...overrides,
  };
}

function sampleValidation(overrides = {}) {
  return {
    isValid: true,
    confidence: 92,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

module.exports = {
  samplePngBuffer,
  samplePdfBuffer,
  sampleParsedInvoice,
  sampleValidation,
};
