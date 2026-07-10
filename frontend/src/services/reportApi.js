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

export const downloadExcel = () =>
  API.get("/download-excel", {
    responseType: "blob",
  });

export const openHtmlReport = () => {
  const token = localStorage.getItem("token");

  window.open(
    `http://localhost:3001/api/report?token=${token}`,
    "_blank"
  );
};