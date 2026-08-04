// src/services/reportApi.js

import api from "./api";

function buildExportParams({ clientId, from, to, format, documentType } = {}) {
  const params = {};

  if (format) params.format = format;
  if (clientId) params.client_id = clientId;
  if (from) params.from = from;
  if (to) params.to = to;
  if (documentType) params.document_type = documentType;

  return params;
}

// ==========================
// Download Excel
// ==========================

export const downloadExcel = (filters = {}) =>
  api.get("/download-excel", {
    params: buildExportParams(filters),
    responseType: "blob",
  });

// ==========================
// Export Invoices
// ==========================

export const exportInvoices = (filters = {}) =>
  api.get("/export", {
    params: buildExportParams(filters),
    responseType: "blob",
  });

// ==========================
// Open HTML Report
// ==========================

// Fetches the report through the normal header-authenticated client
// instead of putting the JWT in the URL (AUTH-04/FE-09 — a URL token
// leaks into browser history and any server/proxy access logs).
// window.open() is called synchronously, before the await, so the
// browser still treats it as a direct result of the click and doesn't
// block it as a popup; once the report is fetched we just redirect
// that already-open tab to a local blob URL.
export const openHtmlReport = (filters = {}) => {
  const reportWindow = window.open("", "_blank");

  api
    .get("/report", {
      params: buildExportParams(filters),
      responseType: "blob",
    })
    .then((response) => {
      const blobUrl = URL.createObjectURL(
        new Blob([response.data], { type: "text/html" })
      );

      if (reportWindow) {
        reportWindow.location.href = blobUrl;
      }

      // Give the tab time to load the blob before revoking it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    })
    .catch((err) => {
      if (reportWindow) {
        reportWindow.close();
      }

      throw err;
    });
};