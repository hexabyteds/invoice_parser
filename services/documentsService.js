const invoiceRepository = require("../repositories/invoiceRepository");
const bankStatementRepository = require("../repositories/bankStatementRepository");
const { DOCUMENT_TYPES, INVOICE_DOCUMENT_TYPES } = require("../utils/documentTypes");

// Documents list only ever needs offset+limit rows from each source (it's
// not the transactions table, which has its own server-side pagination) —
// capped so a very deep page request can't force an unbounded fetch.
const FETCH_CAP = 500;

function normalizeInvoice(row) {
    return {
        id: row.id,
        clientId: row.clientId,
        documentType: row.documentType,
        fileName: row.imagePath ? row.imagePath.split("/").pop() : null,
        number: row.invoiceNo,
        partyOrBank: row.clientName,
        date: row.invoiceDate,
        amount: row.totalAmount,
        currency: row.currency,
        status: "PROCESSED",
        uploadedAt: row.createdAt,
    };
}

// The stored file name is multer's generated upload id (e.g.
// "invoice_1699999999999_<uuid>.pdf"), never user-facing. Prefer a name
// built from the extracted bank name, falling back to the originally
// uploaded file name, and only then to the storage path's basename.
function bankStatementDisplayName(row) {
    if (row.bankName) {
        return `${row.bankName.trim().replace(/\s+/g, "_")}_Statement`;
    }

    if (row.originalFilename) {
        return row.originalFilename;
    }

    return row.imagePath ? row.imagePath.split("/").pop() : null;
}

function normalizeBankStatement(row) {
    return {
        id: row.id,
        clientId: row.clientId,
        documentType: DOCUMENT_TYPES.BANK_STATEMENT,
        fileName: bankStatementDisplayName(row),
        number: null,
        partyOrBank: row.bankName,
        date: row.toDate,
        amount: row.closingBalance,
        currency: row.currency,
        status: row.status,
        uploadedAt: row.createdAt,
    };
}

class DocumentsService {

    // Fans out to invoiceRepository + bankStatementRepository (each of
    // which already bakes "WHERE company_id = ?" ownership into its SQL),
    // normalizes both into a common row shape, merges, sorts by upload
    // date, and paginates in memory. GET /api/invoices is untouched and
    // keeps serving invoice/bill-only consumers (Analytics, export).
    async list(companyId, {
        clientId = null,
        documentType = null,
        from = null,
        to = null,
        limit = 20,
        offset = 0,
    } = {}) {

        const wantInvoices = !documentType || INVOICE_DOCUMENT_TYPES.includes(documentType);
        const wantBankStatements = !documentType || documentType === DOCUMENT_TYPES.BANK_STATEMENT;

        const fetchSize = Math.min(FETCH_CAP, offset + limit);
        const invoiceDocumentType = wantInvoices && INVOICE_DOCUMENT_TYPES.includes(documentType)
            ? documentType
            : null;

        const [invoiceRows, invoiceTotal, bankStatementRows, bankStatementTotal] = await Promise.all([
            wantInvoices
                ? (clientId
                    ? invoiceRepository.findByClient(companyId, clientId, { limit: fetchSize, offset: 0, documentType: invoiceDocumentType, from, to })
                    : invoiceRepository.findByCompany(companyId, { limit: fetchSize, offset: 0, documentType: invoiceDocumentType, from, to }))
                : Promise.resolve([]),

            wantInvoices
                ? (clientId
                    ? invoiceRepository.countByClient(companyId, clientId, { documentType: invoiceDocumentType, from, to })
                    : invoiceRepository.countByCompany(companyId, { documentType: invoiceDocumentType, from, to }))
                : Promise.resolve(0),

            wantBankStatements
                ? (clientId
                    ? bankStatementRepository.findByClient(companyId, clientId, { limit: fetchSize, offset: 0, from, to })
                    : bankStatementRepository.findByCompany(companyId, { limit: fetchSize, offset: 0, from, to }))
                : Promise.resolve([]),

            wantBankStatements
                ? (clientId
                    ? bankStatementRepository.countByClient(companyId, clientId, { from, to })
                    : bankStatementRepository.countByCompany(companyId, { from, to }))
                : Promise.resolve(0),
        ]);

        const merged = [
            ...invoiceRows.map(normalizeInvoice),
            ...bankStatementRows.map(normalizeBankStatement),
        ].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        const documents = merged.slice(offset, offset + limit);
        const total = invoiceTotal + bankStatementTotal;

        return { documents, total };
    }
}

module.exports = new DocumentsService();
