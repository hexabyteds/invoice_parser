import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { getStoredUser, isAdmin as checkIsAdmin } from "../utils/roles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    api
      .get("/auth/me")
      .then((response) => {
        if (response.data.success) {
          setUser(response.data.user);
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: checkIsAdmin(user),
      login(userData, token) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
      },
      logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      },
    }),
    [user]
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
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
