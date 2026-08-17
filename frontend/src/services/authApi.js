import api from "./api";

const authApi = {
  me: () => api.get("/auth/me"),
  updateProfile: (data) => api.put("/auth/profile", data),
  loginHistory: () => api.get("/auth/recent-logins"),
};

export default authApi;
