/**
 * API root. Leave VITE_API_URL empty to call same-origin `/api` (Vite dev proxy, a Vercel
 * rewrite or nginx). Set it only for an API on a sibling subdomain of the same site: the
 * refresh cookie is blocked as a third-party cookie on any other domain (see DEPLOYMENT.md).
 */
export const API_ROOT = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "")}/api`;
const BASE = API_ROOT;

export class ApiError extends Error {
  status: number;
  /** Names of the form fields the server complained about, when it answered with field errors. */
  fields: string[];
  /** Machine-readable error code (`borrow_limit`, `no_active_account`, …); the UI translates it. */
  code?: string;
  params?: Record<string, unknown>;
  /** Per-field validation codes, e.g. `{ password: ["password_too_common"] }`. */
  fieldCodes?: Record<string, string[]>;
  constructor(
    status: number,
    message: string,
    fields: string[] = [],
    extra: { code?: string; params?: Record<string, unknown>; fieldCodes?: Record<string, string[]> } = {},
  ) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = extra.code;
    this.params = extra.params;
    this.fieldCodes = extra.fieldCodes;
  }
}

/** Sent on the cookie-authenticated endpoints; a cross-site form or image cannot add a custom header. */
export const CSRF_HEADER = "X-Library-CSRF";

// The access token lives only in memory (10 minutes). The refresh token is an httpOnly cookie
// the page cannot read; `auth.restore()` and `refreshAccess()` trade it for a new access token.
let accessToken: string | null = null;
export const getAccessToken = () => accessToken;

// Earlier versions kept both tokens in localStorage. Remove them so nothing readable lingers.
try {
  localStorage.removeItem("lb_access");
  localStorage.removeItem("lb_refresh");
} catch { /* storage blocked */ }

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("lb-auth") : null;
channel?.addEventListener("message", (e) => {
  if (e.data === "logout") endSession();
});

function endSession() {
  accessToken = null;
  window.dispatchEvent(new Event("lb:logout"));
}

async function requestRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { [CSRF_HEADER]: "1" },
      credentials: "include",
    });
    if (!res.ok) return null;
    accessToken = (await res.json()).access;
    return accessToken;
  } catch {
    return null;
  }
}

let refreshing: Promise<string | null> | null = null;

/**
 * Trade the refresh cookie for a new access token. Callers in this tab share one request; across
 * tabs a Web Lock serialises them, because rotation makes the old cookie invalid and two parallel
 * refreshes would sign one tab out. Once the lock is ours the browser holds the newest cookie.
 */
function refreshAccess(): Promise<string | null> {
  if (!refreshing) {
    const run = async () => (navigator.locks
      ? await navigator.locks.request("lb-auth-refresh", requestRefresh)
      : await requestRefresh());
    refreshing = run().finally(() => { refreshing = null; });
  }
  return refreshing;
}

/** `fetch` with the Bearer token: on a 401 it refreshes once and retries once, then ends the session. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (access: string | null) => {
    const headers = new Headers(init.headers);
    if (access) headers.set("Authorization", `Bearer ${access}`);
    return fetch(url, { ...init, headers, credentials: "include" });
  };
  let res = await send(accessToken);
  if (res.status === 401) {
    const fresh = await refreshAccess();
    if (fresh) res = await send(fresh);
  }
  if (res.status === 401) endSession();
  return res;
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; keepalive?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true, keepalive } = opts;

  const headers: Record<string, string> = {};
  // A FormData body (a file upload) sets its own multipart Content-Type, with the boundary.
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  // `keepalive` lets the request outlive the page: used when a page unloads with an action still waiting.
  const init: RequestInit = { method, headers, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), keepalive };
  let res: Response;
  try {
    res = auth
      ? await authFetch(`${BASE}${path}`, init)
      : await fetch(`${BASE}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError(0, "Network error — the server could not be reached.", [], { code: "network" });
  }

  if (res.status === 401 && auth) {
    throw new ApiError(401, "Session expired — please sign in again.", [], { code: "not_authenticated" });
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    let fields: string[] = [];
    let extra: ConstructorParameters<typeof ApiError>[3] = {};
    try {
      const data = await res.json();
      if (data.fields) {
        // Validation errors: the per-field messages, joined, are the English text.
        fields = Object.keys(data.fields);
        detail = Object.values(data.fields).flat().join(" ") || data.detail || detail;
      } else {
        detail = data.detail || detail;
      }
      extra = { code: data.code, params: data.params, fieldCodes: data.fieldCodes };
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, detail, fields, extra);
  }
  if (res.status === 204) return undefined as T;
  // 202 Accepted answers carry no body.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const auth = {
  async login(email: string, password: string) {
    const data = await api<{ access: string }>("/auth/login", {
      method: "POST",
      body: { username: email, password },
      auth: false,
    });
    accessToken = data.access;
  },
  async logout() {
    accessToken = null;
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: "POST",
        headers: { [CSRF_HEADER]: "1" },
        credentials: "include",
      });
    } catch { /* offline: the cookie expires on its own */ }
    channel?.postMessage("logout");
  },
  /** Called once at startup: sign back in from the refresh cookie, if there is one. */
  async restore(): Promise<boolean> {
    return (await refreshAccess()) !== null;
  },
};
