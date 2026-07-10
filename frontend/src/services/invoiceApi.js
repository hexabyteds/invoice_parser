// src/services/invoiceApi.js

import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:3001/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ==========================
// Upload Invoice
// ==========================

export const uploadInvoice = (formData) =>
  API.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// ==========================
// Get All Invoices
// ==========================

export const getInvoices = () =>
  API.get("/invoices");

// ==========================
// Dashboard Statistics
// ==========================

export const getStats = () =>
  API.get("/stats");

// ==========================
// Download Excel
// ==========================

export const downloadExcel = () =>
  API.get("/download-excel", {
    responseType: "blob",
  });


  export const getInvoice = (id) =>
    API.get(`/invoices/${id}`);

  
// ==========================
// HTML Report
// ==========================

export const downloadReport = () =>
  API.get("/report", {
    responseType: "blob",
  });