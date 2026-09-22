/**
 * API root. Leave VITE_API_URL empty to call same-origin `/api` (Vite dev proxy
 * or a Vercel rewrite); set it to the backend origin (e.g. https://api.example.com)
 * to call a separately hosted Django server directly.
 */
export const API_ROOT = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")}/api`;
const BASE = API_ROOT;

/** Static demo build (`npm run build:demo`): the API runs in the browser, no server needed. */
export const DEMO = import.meta.env.VITE_DEMO === "true";

export const DEMO_STORAGE_KEY = "lb_demo_state_v1";

/** Seeded demo accounts offered as one-click sign-ins in demo builds. */
export const DEMO_ACCOUNTS = [
  { label: "Member", name: "Priya Sharma", email: "priya@example.com" },
  { label: "Member · overdue", name: "Daniel Okafor", email: "daniel@example.com" },
  { label: "Staff", name: "Marcus Holloway", email: "staff@libborrow.dev" },
  { label: "Admin", name: "Eleanor Vance", email: "admin@libborrow.dev" },
];
export const DEMO_PASSWORD = "password123";

/** Wipe the browser-stored demo data and session, then reload onto a fresh seed. */
export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    localStorage.removeItem("lb_access");
    localStorage.removeItem("lb_refresh");
  } catch { /* storage blocked — the reload still resets in-memory state */ }
  window.location.assign("/");
}

/** `fetch` for API calls — routed to the in-browser mock backend in demo builds. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (DEMO) return (await import("@/api/demo")).demoFetch(url, init);
  return fetch(url, init);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const tokens = {
  get access() { return localStorage.getItem("lb_access"); },
  get refresh() { return localStorage.getItem("lb_refresh"); },
  set(access: string, refresh: string) {
    localStorage.setItem("lb_access", access);
    localStorage.setItem("lb_refresh", refresh);
  },
  clear() {
    localStorage.removeItem("lb_access");
    localStorage.removeItem("lb_refresh");
  },
};

async function refreshAccess(): Promise<string | null> {
  if (!tokens.refresh) return null;
  try {
    const res = await apiFetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem("lb_access", data.access);
    return data.access;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const doFetch = async (access: string | null) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && access) headers.Authorization = `Bearer ${access}`;
    return apiFetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(tokens.access);
  if (res.status === 401 && auth && tokens.refresh) {
    const fresh = await refreshAccess();
    if (fresh) res = await doFetch(fresh);
  }
  if (res.status === 401 && auth) {
    tokens.clear();
    window.dispatchEvent(new Event("lb:logout"));
    throw new ApiError(401, "Session expired — please sign in again.");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || Object.values(data).flat().join(" ") || detail;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const auth = {
  async login(email: string, password: string) {
    const data = await api<{ access: string; refresh: string }>("/auth/login", {
      method: "POST",
      body: { username: email, password },
      auth: false,
    });
    tokens.set(data.access, data.refresh);
  },
  logout() {
    tokens.clear();
  },
  isLoggedIn: () => !!tokens.access,
};
