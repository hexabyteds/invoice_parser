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
};

export default adminApi;
