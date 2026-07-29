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
} from "../utils/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

  const navigate = useNavigate();

  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {

    const token = getToken();

    if (!token) return;

    api
      .get("/auth/me")
      .then((response) => {

        if (response.data.success) {

          setUser(response.data.user);
          updateStoredUser(response.data.user);

        }

      })
      .catch(() => {});

  }, []);

  const value = useMemo(
    () => ({

      user,

      isAdmin: checkIsAdmin(user),

      login(userData, token, remember = true) {

        saveSession(token, userData, remember);

        setUser(userData);

      },

      logout() {

        clearSession();

        setUser(null);

        navigate("/login", {
          replace: true
        });

      },

    }),
    [user, navigate]
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