import api from "./api";

const planApi = {
  // Public/customer-facing: active plans only (used by the pricing page
  // and the customer Profile page's "Switch Plan" list).
  getActive: async () => {
    const { data } = await api.get("/plans");
    return data;
  },

  // Admin-only: ALL plans including disabled ones — the admin list must
  // see disabled plans too, otherwise there's no way to re-enable one once
  // it's toggled off.
  getAll: async () => {
    const { data } = await api.get("/plans/admin");
    return data;
  },

  getById: async (id) => {
    const { data } = await api.get(`/plans/${id}`);
    return data;
  },

  create: async (payload) => {
    const { data } = await api.post("/plans", payload);
    return data;
  },

  update: async (id, payload) => {
    const { data } = await api.put(`/plans/${id}`, payload);
    return data;
  },

  changeStatus: async (id, active) => {
    const { data } = await api.patch(`/plans/${id}/status`, { active });
    return data;
  },

  delete: async (id) => {
    const { data } = await api.delete(`/plans/${id}`);
    return data;
  },
};

export default planApi;
