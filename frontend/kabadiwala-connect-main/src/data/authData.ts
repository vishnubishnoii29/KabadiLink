import { UserProfile, UserRole } from "../types";

export const DEMO_ACCOUNTS: Record<UserRole, UserProfile> = {
  collector: {
    id: "demo-collector-1",
    name: "Demo Collector Account",
    phone: "+91 98201 44820",
    role: "collector",
    location: "Demo collection zone",
    preferredLanguage: "hi",
    identificationId: "DEMO-COLLECTOR",
    organizationName: "Demo E-Waste Collection Team",
    isDemoAccount: true,
  },
  recycler: {
    id: "demo-recycler-1",
    name: "Demo Recycler Account",
    phone: "+91 98334 11029",
    role: "recycler",
    location: "Demo recycling zone",
    preferredLanguage: "en",
    identificationId: "DEMO-RECYCLER",
    organizationName: "Demo Recycling Organization",
    cpcbRegNumber: "DEMO-AUTHORIZATION",
    isDemoAccount: true,
  },
  admin: {
    id: "demo-admin-1",
    name: "Demo Admin Account",
    phone: "+91 98110 54321",
    role: "admin",
    location: "Demo oversight office",
    preferredLanguage: "en",
    identificationId: "DEMO-ADMIN",
    organizationName: "Demo Environmental Oversight Team",
    isDemoAccount: true,
  },
};

const STORAGE_KEY = "kabadiwala_connect_user_session";

export function getSavedSession(): UserProfile | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to parse saved user session:", e);
  }
  return null;
}

export function saveSession(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error("Failed to save user session:", e);
  }
}
