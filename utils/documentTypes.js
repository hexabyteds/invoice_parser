const DOCUMENT_TYPES = {
  SUPPLIER_INVOICE: "supplier_invoice",
  BILL: "bill",
  BANK_STATEMENT: "bank_statement",
};

// Values allowed in invoices.document_type (that ENUM column is untouched
// by the bank statement feature — bank statements live in their own
// bank_statements table). Used to validate GET/PUT /api/invoices.
const INVOICE_DOCUMENT_TYPES = [
  DOCUMENT_TYPES.SUPPLIER_INVOICE,
  DOCUMENT_TYPES.BILL,
];

// Every type selectable at upload. Used to validate POST /api/upload.
const ALL_DOCUMENT_TYPES = [
  ...INVOICE_DOCUMENT_TYPES,
  DOCUMENT_TYPES.BANK_STATEMENT,
];

function isValidDocumentType(value) {
  return ALL_DOCUMENT_TYPES.includes(value);
}

function isValidInvoiceDocumentType(value) {
  return INVOICE_DOCUMENT_TYPES.includes(value);
}

function isBankStatementType(value) {
  return value === DOCUMENT_TYPES.BANK_STATEMENT;
}

module.exports = {
  DOCUMENT_TYPES,
  INVOICE_DOCUMENT_TYPES,
  ALL_DOCUMENT_TYPES,
  isValidDocumentType,
  isValidInvoiceDocumentType,
  isBankStatementType,
};
