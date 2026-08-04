import api from "./api";

const dashboardApi = {
  getSummary: (clientId = null, documentType = null) =>
    api.get("/dashboard/summary", {
      params: {
        ...(clientId ? { client_id: clientId } : {}),
        ...(documentType ? { document_type: documentType } : {}),
      },
    }),
  getMonthly: (clientId = null) =>
    api.get("/dashboard/monthly", { params: clientId ? { client_id: clientId } : {} }),
  getTopClients: () => api.get("/dashboard/top-clients"),
  getConfidenceDistribution: (clientId = null) =>
    api.get("/dashboard/confidence-distribution", {
      params: clientId ? { client_id: clientId } : {},
    }),
  getQuality: (clientId = null) =>
    api.get("/dashboard/quality", { params: clientId ? { client_id: clientId } : {} }),
  getClientAnalytics: () => api.get("/dashboard/client-analytics"),
  getActivity: () => api.get("/dashboard/activity"),
};

export default dashboardApi;
