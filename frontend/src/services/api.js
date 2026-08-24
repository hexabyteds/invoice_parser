import axios from "axios";
import { getToken, clearSession, getCurrentCompanyId } from "../utils/authStorage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==========================================
// REQUEST INTERCEPTOR
// ==========================================

// These endpoints are meant to be called anonymously. If a stale (but
// still-valid) token happens to be sitting in storage from a previous
// session, we must not attach it here — otherwise a 401 caused by simply
// entering the wrong password gets misread by the response interceptor
// below as "the stored session expired," and force-redirects away before
// the login page's own error handling ever runs.
const PUBLIC_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/contact",
];

api.interceptors.request.use(
  (config) => {

    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((path) =>
      config.url?.includes(path)
    );

    const token = getToken();

    if (token && !isPublicEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;

      // Names which workspace this request acts in. The backend never
      // trusts this alone — companyContext re-verifies the caller actually
      // has an active membership in it — so this is purely a UI selection,
      // not an authorization boundary. Omitted when unset, in which case
      // the backend defaults to the caller's own owned company.
      const companyId = getCurrentCompanyId();

      if (companyId) {
        config.headers["X-Company-Id"] = companyId;
      }
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

    // Only treat a 401 as "session expired" when the request actually
    // carried a token. A 401 from an unauthenticated request (e.g. a
    // failed login attempt itself) isn't a session expiring — it's just
    // wrong credentials, and should be left for the calling page's own
    // error handling instead of force-navigating away before it can run.
    const hadToken = Boolean(error.config?.headers?.Authorization);

    if (
      error.response?.status === 401 &&
      hadToken &&
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