import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function buildExportParams({ clientId, from, to, format } = {}) {
  const params = {};

  if (format) params.format = format;
  if (clientId) params.client_id = clientId;
  if (from) params.from = from;
  if (to) params.to = to;

  return params;
}

export const downloadExcel = (filters = {}) =>
  API.get("/download-excel", {
    params: buildExportParams(filters),
    responseType: "blob",
  });

export const exportInvoices = (filters = {}) =>
  API.get("/export", {
    params: buildExportParams(filters),
    responseType: "blob",
  });

export const openHtmlReport = (filters = {}) => {
  const token = localStorage.getItem("token");
  const params = new URLSearchParams(buildExportParams(filters));

  if (token) {
    params.set("token", token);
  }

  window.open(
    `${import.meta.env.VITE_API_URL}/report?${params.toString()}`,
    "_blank"
  );
};
