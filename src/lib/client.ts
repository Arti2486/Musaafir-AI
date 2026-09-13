"use client";

export const TOKEN_KEY = "musaafir_token";
export const USER_KEY = "musaafir_user";

export type SessionUser = { id: number; name: string; email: string };

export class ApiError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/* ── session storage (localStorage, as required) ───────────────────────────── */

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("[AUTH] could not persist the session in localStorage:", error);
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/* ── fetch wrapper ─────────────────────────────────────────────────────────── */

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Attach the bearer token when present (default true). */
  auth?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (networkError) {
    throw new ApiError(
      "Cannot reach the Musaafir API. Is the Next.js server running?",
      0,
      networkError instanceof Error ? networkError.message : String(networkError),
    );
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const record = (payload ?? {}) as Record<string, unknown>;
    const message =
      typeof record.message === "string" && record.message
        ? record.message
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, typeof record.detail === "string" ? record.detail : undefined);
  }

  return payload as T;
}

/* ── auth helpers ──────────────────────────────────────────────────────────── */

export async function loginRequest(email: string, password: string): Promise<SessionUser> {
  const data = await apiFetch<{ token: string; user: SessionUser; message?: string }>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  setSession(data.token, data.user);
  return data.user;
}

export async function signupRequest(name: string, email: string, password: string): Promise<{ user: SessionUser; token?: string }> {
  return apiFetch<{ user: SessionUser; token?: string; message: string }>("/api/auth/signup", {
    method: "POST",
    auth: false,
    body: { name, email, password },
  });
}

export async function fetchMe(): Promise<SessionUser | null> {
  if (!getToken()) return null;
  try {
    const data = await apiFetch<{ user: SessionUser }>("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* the local session is cleared either way */
  } finally {
    clearSession();
  }
}

/* ── formatting ────────────────────────────────────────────────────────────── */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatINR(value: number): string {
  return `₹${inr.format(Math.round(value || 0))}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
