import { createContext, useContext, useEffect, useState } from 'react';
import { api, clearSessionToken, createSession, onUnauthorized } from '../api.js';

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

  const login = async (credentials) => {
    const data = await createSession(credentials);
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    clearSessionToken();
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
