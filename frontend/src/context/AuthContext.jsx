import { createContext, useContext, useEffect, useState } from 'react';
import { api, onUnauthorized } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = onUnauthorized(() => {
      if (active) setUser(null);
    });

    api('/auth/me')
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = async (credentials) => { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setUser(data.user); return data.user; };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
