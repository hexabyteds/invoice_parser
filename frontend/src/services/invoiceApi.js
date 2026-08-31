// src/services/invoiceApi.js

import api from "./api";

// ==========================
// Upload Invoice
// ==========================

export const uploadInvoice = (formData) =>
  api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// ==========================
// Get All Invoices
// ==========================

export const getInvoices = (documentType, from, to) =>
  api.get("/invoices", {
    params: {
      ...(documentType ? { document_type: documentType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  });

// ==========================
// Dashboard Statistics
// ==========================

export const getStats = () =>
  api.get("/stats");

// ==========================
// Download Excel
// ==========================

export const downloadExcel = () =>
  api.get("/download-excel", {
    responseType: "blob",
  });

// ==========================
// Get Single Invoice
// ==========================

export const getInvoice = (id) =>
  api.get(`/invoices/${id}`);

// ==========================
// Get Invoice Source
// ==========================

export const getInvoiceSource = (id) =>
  api.get(`/invoices/${id}/source`, {
    responseType: "blob",
  });

// ==========================
// Update Invoice
// ==========================

export const updateInvoice = (id, data, config = {}) =>
  api.put(`/invoices/${id}`, data, config);

// ==========================
// Delete Invoice
// ==========================

export const deleteInvoices = (id) =>
  api.delete(`/invoices/${id}`);

// ==========================
// HTML Report
// ==========================

export const downloadReport = () =>
  api.get("/report", {
    responseType: "blob",
  });

// ==========================
// Get Invoices By Client
// ==========================

export const getInvoicesByClient = (clientId, documentType, from, to) =>
  api.get("/invoices", {
    params: {
      client_id: clientId,
      ...(documentType ? { document_type: documentType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  });

// ==========================
// Get Bills By Supplier
// ==========================

export const getInvoicesBySupplier = (supplierId, documentType, from, to) =>
  api.get("/invoices", {
    params: {
      supplier_id: supplierId,
      ...(documentType ? { document_type: documentType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  });