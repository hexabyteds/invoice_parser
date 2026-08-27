import api from "./api";

const adminApi = {
  getStats: async () => {
    const { data } = await api.get("/admin/stats");
    return data;
  },

  getCustomers: async ({ limit = 20, offset = 0 } = {}) => {
    const { data } = await api.get("/admin/customers", {
      params: { limit, offset },
    });
    return data;
  },

  getCustomer: async (id) => {
    const { data } = await api.get(`/admin/customers/${id}`);
    return data;
  },

  getCustomerLoginHistory: async (id) => {
    const { data } = await api.get(`/admin/customers/${id}/login-history`);
    return data;
  },

  updateCustomer: async (id, payload) => {
    const { data } = await api.put(`/admin/customers/${id}`, payload);
    return data;
  },

  updateCustomerStatus: async (id, status) => {
    const { data } = await api.patch(`/admin/customers/${id}/status`, { status });
    return data;
  },

  updateCustomerPlan: async (id, planId, billingCycle = "monthly") => {
    const { data } = await api.patch(`/admin/customers/${id}/plan`, {
      planId,
      billingCycle,
    });
    return data;
  },

  getSubscriptions: async () => {
    const { data } = await api.get("/admin/subscriptions");
    return data;
  },

  resetCustomerPassword: async (id, password) => {
    const { data } = await api.post(`/admin/customers/${id}/reset-password`, {
      password,
    });
    return data;
  },

  deleteCustomer: async (id) => {
    const { data } = await api.delete(`/admin/customers/${id}`);
    return data;
  },

  // Company Management module
  getCompaniesSummary: async () => {
    const { data } = await api.get("/admin/companies/summary");
    return data;
  },

  getCompanies: async ({ limit = 20, offset = 0, ...filters } = {}) => {
    const { data } = await api.get("/admin/companies", {
      params: { limit, offset, ...filters },
    });
    return data;
  },

  getCompany: async (id) => {
    const { data } = await api.get(`/admin/companies/${id}`);
    return data;
  },

  getCompanyActivity: async (id) => {
    const { data } = await api.get(`/admin/companies/${id}/activity`);
    return data;
  },

  updateCompanyStatus: async (id, status) => {
    const { data } = await api.patch(`/admin/companies/${id}/status`, { status });
    return data;
  },

  // Analytics module
  getAnalyticsSummary: async () => {
    const { data } = await api.get("/admin/analytics/summary");
    return data;
  },

  getAnalyticsGrowth: async ({ metric, range }) => {
    const { data } = await api.get("/admin/analytics/growth", { params: { metric, range } });
    return data;
  },

  getAnalyticsDetails: async (range) => {
    const { data } = await api.get("/admin/analytics/details", { params: { range } });
    return data;
  },

  // Audit Logs module
  getAuditLogs: async ({ limit = 25, offset = 0, ...filters } = {}) => {
    const { data } = await api.get("/admin/audit-logs", { params: { limit, offset, ...filters } });
    return data;
  },

  getAuditLogFilterOptions: async () => {
    const { data } = await api.get("/admin/audit-logs/filter-options");
    return data;
  },

  // Payments module
  getPaymentsSummary: async () => {
    const { data } = await api.get("/admin/payments/summary");
    return data;
  },

  getPayments: async ({ limit = 20, startingAfter, status } = {}) => {
    const { data } = await api.get("/admin/payments", { params: { limit, startingAfter, status } });
    return data;
  },

  getPaymentDetail: async (id) => {
    const { data } = await api.get(`/admin/payments/${id}`);
    return data;
  },
};

export default adminApi;
