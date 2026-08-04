const DOCUMENT_TYPES = ["supplier_invoice", "bill"];

function isValidDocumentType(value) {
  return DOCUMENT_TYPES.includes(value);
}

module.exports = {
  DOCUMENT_TYPES,
  isValidDocumentType,
};
