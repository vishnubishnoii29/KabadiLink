export const BASE_URL: string = (() => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    // When accessed from a phone/tablet on local Wi-Fi or hotspot via IP
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      return `http://${hostname}:8000`;
    }
  }
  return envUrl || "http://localhost:8000";
})();

export const TOKEN_KEY = "kabadilink_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  // Also clean up old prototype session keys
  localStorage.removeItem("kabadiwala_connect_user_session");
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = "API_ERROR", status = 500, details?: any) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  isFormData?: boolean;
  auth?: boolean;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
}

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    isFormData = false,
    auth = true,
    params,
    headers = {},
  } = options;

  let url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const reqHeaders: Record<string, string> = { ...headers };

  if (auth) {
    const token = getToken();
    if (token) {
      reqHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  let reqBody: any = undefined;

  if (body !== undefined && body !== null) {
    if (isFormData) {
      reqBody = body; // Browser sets Content-Type with boundary automatically
    } else {
      reqHeaders["Content-Type"] = "application/json";
      reqBody = JSON.stringify(body);
    }
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kabadilink:unauthorized"));
    }
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let responseData: any;
  try {
    responseData = isJson ? await res.json() : await res.text();
  } catch (err) {
    responseData = null;
  }

  if (!res.ok) {
    if (responseData && typeof responseData === "object" && responseData.error) {
      const { code = "HTTP_ERROR", message = "Request failed" } = responseData.error;
      throw new ApiError(message, code, res.status, responseData);
    }
    const message = (typeof responseData === "string" && responseData) || res.statusText || `HTTP ${res.status}`;
    throw new ApiError(message, `HTTP_${res.status}`, res.status, responseData);
  }

  return responseData as T;
}
