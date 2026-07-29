import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Runs once when the app first loads
  useEffect(() => {
    const savedToken = localStorage.getItem("token");

    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Calls /api/me/ using the given token to get the logged-in user's data
  const fetchCurrentUser = async (authToken) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/me/", {
        method: "GET",
        headers: {
          Authorization: `Token ${authToken}`,
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

  // Called after successful register/login
  const saveAuth = (data) => {
    setToken(data.token);
    setUser({ username: data.username });
    localStorage.setItem("token", data.token);
  };

  // Clears the session locally (state + localStorage)
  const clearAuth = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  // Calls /api/logout/ then clears the session locally regardless of the result
  const logout = async () => {
    try {
      await fetch("http://127.0.0.1:8000/api/logout/", {
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