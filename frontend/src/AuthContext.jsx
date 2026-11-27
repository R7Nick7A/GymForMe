import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';

const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    api.me()
      .then((u) => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const setSession = (token, username) => {
    setToken(token);
    setUser({ username });
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (_) {}
    clearToken();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, setSession, logout }}>{children}</AuthContext.Provider>;
}
