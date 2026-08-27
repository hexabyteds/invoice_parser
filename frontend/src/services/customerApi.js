import api from "./api";

const customerApi = {
  // Get all customers
  getAll: async () => {
    const { data } = await api.get("/customers");
    return data;
  },

  // Get single customer
  get: async (id) => {

    const { data } = await api.get(`/customers/${id}`);

    return data;
  },

  // Create customer
  create: async (customer) => {
    try {



      const response = await api.post("/customers", customer);



      return response.data;

    } catch (error) {



      throw error;
    }
  },

  // Update customer
  update: async (id, customer) => {
    const { data } = await api.put(`/customers/${id}`, customer);
    return data;
  },

  // Activate / deactivate customer
  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/customers/${id}/status`, { status });
    return data;
  },

  // Delete customer
  delete: async (id) => {
    const { data } = await api.delete(`/customers/${id}`);
    return data;
  },

  // Get customer invoices
  // NOTE: the ?client_id= query param name is a frozen external wire
  // contract with the invoice/upload/export/analytics endpoints — do not
  // rename it even though the underlying DB column is now customer_id.
  getInvoices: async (clientId) => {
    const { data } = await api.get(`/invoices?client_id=${clientId}`);
    return data;
  },

  // Get customer statistics
  getStats: async (clientId) => {
    const { data } = await api.get(`/stats?client_id=${clientId}`);
    return data;
  },

// Download customer excel
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

export default customerApi;
