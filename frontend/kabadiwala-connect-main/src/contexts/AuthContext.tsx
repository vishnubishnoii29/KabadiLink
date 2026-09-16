import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, UserRole } from "../types/api";
import { getToken, clearToken } from "../lib/api/client";
import {
  getMe,
  loginWithPassword as apiLoginPassword,
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  registerUser as apiRegister,
  logoutUser as apiLogout,
  RegisterPayload,
  OtpRequestResponse,
} from "../lib/api/auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isLoading: boolean;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  requestOtp: (phone: string, delivery?: "DEV_LOG" | "EMAIL" | "WHATSAPP") => Promise<OtpRequestResponse>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await getMe();
      setUser(userData);
      setTokenState(currentToken);
    } catch (err) {
      console.warn("Session hydration failed:", err);
      clearToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      setTokenState(null);
    };

    window.addEventListener("kabadilink:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("kabadilink:unauthorized", handleUnauthorized);
    };
  }, [refreshUser]);

  const loginWithPassword = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiLoginPassword(phone, password);
      setTokenState(res.token);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const requestOtp = async (phone: string, delivery?: "DEV_LOG" | "EMAIL" | "WHATSAPP") => {
    return apiRequestOtp({ phone, delivery });
  };

  const verifyOtp = async (phone: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await apiVerifyOtp({ phone, code });
      setTokenState(res.token);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await apiRegister(payload);
      setTokenState(res.token);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isLoading,
        loginWithPassword,
        requestOtp,
        verifyOtp,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
