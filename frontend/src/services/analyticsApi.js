import api from "./api";

export const getAnalytics = (clientId = null) =>
  api.get("/analytics", {
    params: clientId ? { client_id: clientId } : {},
  });
