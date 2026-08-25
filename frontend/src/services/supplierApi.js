import api from "./api";

const supplierApi = {
  // Get all suppliers
  getAll: async () => {
    const { data } = await api.get("/suppliers");
    return data;
  },

  // Get single supplier
  get: async (id) => {
    const { data } = await api.get(`/suppliers/${id}`);
    return data;
  },

  // Create supplier
  create: async (supplier) => {
    const { data } = await api.post("/suppliers", supplier);
    return data;
  },

  // Update supplier
  update: async (id, supplier) => {
    const { data } = await api.put(`/suppliers/${id}`, supplier);
    return data;
  },

  // Activate / deactivate supplier
  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/suppliers/${id}/status`, { status });
    return data;
  },

  // Delete supplier
  delete: async (id) => {
    const { data } = await api.delete(`/suppliers/${id}`);
    return data;
  },
};

export default supplierApi;
