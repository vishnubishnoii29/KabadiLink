import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('kabadilink_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await api.getMe();
          setUser(profile);
        } catch (err) {
          console.warn('Failed to load authenticated user profile:', err);
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const loginWithPassword = async (phone, password) => {
    const res = await api.login(phone, password);
    localStorage.setItem('kabadilink_token', res.token);
    setToken(res.token);
    setUser({ id: res.user_id, role: res.role, phone });
    return res;
  };

  const loginWithOtp = async (phone, code) => {
    const res = await api.verifyOtp(phone, code);
    localStorage.setItem('kabadilink_token', res.token);
    setToken(res.token);
    setUser({ id: res.user_id, role: res.role, phone });
    return res;
  };

  const register = async (data) => {
    const res = await api.register(data);
    localStorage.setItem('kabadilink_token', res.token);
    setToken(res.token);
    setUser({ id: res.user_id, role: res.role, phone: res.phone });
    return res;
  };

  const logout = () => {
    localStorage.removeItem('kabadilink_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithPassword, loginWithOtp, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
