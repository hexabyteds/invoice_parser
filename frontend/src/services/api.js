import axios from "axios";
import { getToken, clearSession } from "../utils/authStorage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==========================================
// REQUEST INTERCEPTOR
// ==========================================

api.interceptors.request.use(
  (config) => {

    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);


// ==========================================
// RESPONSE INTERCEPTOR
// ==========================================

let isLoggingOut = false;

api.interceptors.response.use(

  // Successful response
  (response) => {
    return response;
  },

  // Error response
  (error) => {

    if (
      error.response?.status === 401 &&
      !isLoggingOut
    ) {

      isLoggingOut = true;

      // Clear authentication
      clearSession();

      // Redirect to login
      window.location.replace("/login");
    }

    return Promise.reject(error);
  }
  

);
export const getPublicPlans = () =>
  api.get("/plans");

export default api;