import api from "./api";

const authApi = {
  me: () => api.get("/auth/me"),
  updateProfile: (data) => api.put("/auth/profile", data),
};

export default authApi;
