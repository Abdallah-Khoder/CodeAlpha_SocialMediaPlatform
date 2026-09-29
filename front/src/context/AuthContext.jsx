import { API_BASE } from "../config";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");

    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (authToken) => {
    const effectiveToken = authToken || token;
    if (!effectiveToken) return;

    try {
      const response = await fetch(`${API_BASE}/api/me/`, {
        method: "GET",
        headers: {
          Authorization: `Token ${effectiveToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Called after successful register/login. Immediately fetches the full
  // profile (including profile_picture) instead of waiting for a refresh.
  const saveAuth = (data) => {
    setToken(data.token);
    localStorage.setItem("token", data.token);
    fetchCurrentUser(data.token);
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/logout/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
        },
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      clearAuth();
    }
  };

  const value = {
    user,
    token,
    loading,
    saveAuth,
    clearAuth,
    logout,
    fetchCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}