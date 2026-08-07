import api from "./api";

const clientApi = {
  // Get all clients
  getAll: async () => {
    const { data } = await api.get("/clients");
    return data;
  },

  // Get single client
  get: async (id) => {
  
    const { data } = await api.get(`/clients/${id}`);
 
    return data;
  },

  // Create client
  create: async (client) => {
    try {
 
  
      
      const response = await api.post("/clients", client);
  
      
  
      return response.data;
  
    } catch (error) {
  
  
  
      throw error;
    }
  },

  // Update client
  update: async (id, client) => {
    const { data } = await api.put(`/clients/${id}`, client);
    return data;
  },

  // Activate / deactivate client
  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/clients/${id}/status`, { status });
    return data;
  },

  // Delete client
  delete: async (id) => {
    const { data } = await api.delete(`/clients/${id}`);
    return data;
  },

  // Get client invoices
  getInvoices: async (clientId) => {
    const { data } = await api.get(`/invoices?client_id=${clientId}`);
    return data;
  },

  // Get client statistics
  getStats: async (clientId) => {
    const { data } = await api.get(`/stats?client_id=${clientId}`);
    return data;
  },

// Download client excel
downloadExcel: async (clientId) => {

  const response = await api.get(
      `/download-excel?client_id=${clientId}`,
      {
          responseType: "blob",
      }
  );

  return response.data;
},

  // HTML Report
  getReport: async (clientId) => {
    const { data } = await api.get(`/report?client_id=${clientId}`);
    return data;
  },
};

export default clientApi;