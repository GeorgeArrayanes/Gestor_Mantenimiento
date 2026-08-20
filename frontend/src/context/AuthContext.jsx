import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api('/auth/me').then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const login = async (credentials) => { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setUser(data.user); return data.user; };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
