import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { useNavigate } from "react-router-dom";

import api from "../services/api";
import { isAdmin as checkIsAdmin } from "../utils/roles";
import {
  getToken,
  getStoredUser,
  saveSession,
  updateStoredUser,
  clearSession,
  getCurrentCompanyId,
  setCurrentCompanyId,
} from "../utils/authStorage";

const AuthContext = createContext(null);

// Picks which company becomes "current" when none is stored yet (fresh
// login, or a stored id that no longer matches any membership — e.g. the
// user was removed from it elsewhere). Prefers the company they OWN, since
// that's the common case; otherwise the first company they have active
// access to. Returns null for a Freelancer with no accepted company yet.
function pickDefaultCompanyId(companies) {
  if (!companies?.length) return null;
  return (companies.find((c) => c.role === "OWNER") || companies[0]).companyId;
}

export function AuthProvider({ children }) {

  const navigate = useNavigate();

  const [user, setUser] = useState(() => getStoredUser());
  const [currentCompanyId, setCurrentCompanyIdState] = useState(() => getCurrentCompanyId());

  function syncUser(userData) {
    setUser(userData);
    updateStoredUser(userData);

    const stillValid = userData.companies?.some((c) => c.companyId === currentCompanyId);

    if (!stillValid) {
      const fallback = pickDefaultCompanyId(userData.companies);
      setCurrentCompanyIdState(fallback);
      if (fallback) setCurrentCompanyId(fallback);
    }
  }

  useEffect(() => {

    const token = getToken();

    if (!token) return;

    api
      .get("/auth/me")
      .then((response) => {

        if (response.data.success) {
          syncUser(response.data.user);
        }

      })
      .catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companies = user?.companies || [];
  const invitations = user?.invitations || [];
  const currentCompany = companies.find((c) => c.companyId === currentCompanyId) || null;

  const value = useMemo(
    () => ({

      user,
      companies,
      invitations,
      currentCompanyId,
      currentCompany,

      isAdmin: checkIsAdmin(user),

      login(userData, token, remember = true) {

        saveSession(token, userData, remember);
        setUser(userData);

        const defaultCompanyId = pickDefaultCompanyId(userData.companies);
        setCurrentCompanyIdState(defaultCompanyId);
        if (defaultCompanyId) setCurrentCompanyId(defaultCompanyId);

      },

      updateUser(userData) {

        updateStoredUser(userData);

        setUser(userData);

      },

      // Re-fetches /auth/me — used after accepting/declining an invitation
      // so companies/invitations reflect the change without a full reload.
      async refreshUser() {
        const response = await api.get("/auth/me");
        if (response.data.success) {
          syncUser(response.data.user);
        }
        return response.data.user;
      },

      // Switching workspaces reloads the page rather than just updating
      // state — every dashboard page fetches its own data independently,
      // and a reload is the only way to guarantee none of them keep
      // showing the previous company's data after the switch (a stale
      // invoice list under the new company's header would be a real
      // cross-tenant leak in the UI, even though the API itself is safe).
      switchCompany(companyId) {
        setCurrentCompanyId(companyId);
        window.location.reload();
      },

      logout() {

        clearSession();

        setUser(null);

        navigate("/login", {
          replace: true
        });

      },

    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, currentCompanyId, navigate]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
}