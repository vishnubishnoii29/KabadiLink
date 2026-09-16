import { request, setToken, clearToken } from "./client";
import { User, UserRole, LanguageCode } from "../../types/api";

export interface RegisterPayload {
  phone: string;
  password?: string;
  role?: UserRole;
  name?: string;
  preferred_language?: LanguageCode;
  is_adult?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface AuthResponse {
  token: string;
  user_id: string;
  role: UserRole;
  phone?: string;
}

export interface OtpRequestPayload {
  phone: string;
  delivery?: "DEV_LOG" | "EMAIL" | "WHATSAPP";
}

export interface OtpRequestResponse {
  requested: boolean;
  delivery: string;
  dev_code?: string;
}

export interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: payload,
    auth: false,
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function loginWithPassword(phone: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { phone, password },
    auth: false,
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function requestOtp(payload: OtpRequestPayload): Promise<OtpRequestResponse> {
  return request<OtpRequestResponse>("/auth/otp/request", {
    method: "POST",
    body: {
      phone: payload.phone,
      delivery: payload.delivery || "DEV_LOG",
    },
    auth: false,
  });
}

export async function verifyOtp(payload: OtpVerifyPayload): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/auth/otp/verify", {
    method: "POST",
    body: payload,
    auth: false,
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function getMe(): Promise<User> {
  return request<User>("/auth/me", {
    method: "GET",
    auth: true,
  });
}

export async function logoutUser(): Promise<void> {
  try {
    await request("/auth/logout", {
      method: "POST",
      auth: true,
    });
  } catch (err) {
    // Ignore server error on logout
  } finally {
    clearToken();
  }
}
