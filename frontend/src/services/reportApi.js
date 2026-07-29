// src/services/reportApi.js

import api from "./api";

function buildExportParams({ clientId, from, to, format } = {}) {
  const params = {};

  if (format) params.format = format;
  if (clientId) params.client_id = clientId;
  if (from) params.from = from;
  if (to) params.to = to;

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

export const openHtmlReport = (filters = {}) => {
  const token = localStorage.getItem("token");

  const params = new URLSearchParams(
    buildExportParams(filters)
  );

  if (token) {
    params.set("token", token);
  }

  window.open(
    `${import.meta.env.VITE_API_URL}/report?${params.toString()}`,
    "_blank"
  );
};