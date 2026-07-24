import api from "./api";

export const getDashboard = () =>
    api.get("/usage/admin/dashboard");

export const getCustomersUsage = () =>
    api.get("/usage/admin");