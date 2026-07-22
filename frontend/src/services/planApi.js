import api from "./api";

const planApi = {
  getAll: async () => {
    const { data } = await api.get("/plans");
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
