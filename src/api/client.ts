const BASE = "/api";

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
    const res = await fetch(`${BASE}/auth/refresh`, {
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
    return fetch(`${BASE}${path}`, {
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
