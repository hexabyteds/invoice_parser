// src/services/documentsApi.js
//
// Unified list across invoice/bill/bank-statement documents (GET
// /api/documents). Distinct from invoiceApi.getInvoices, which stays
// invoice/bill-only and keeps serving Analytics/export.

import api from "./api";

export const getDocuments = ({ clientId, documentType, from, to, limit, offset } = {}) =>
  api.get("/documents", {
    params: {
      ...(clientId ? { client_id: clientId } : {}),
      ...(documentType ? { document_type: documentType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
    },
  });
