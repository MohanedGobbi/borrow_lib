import { api } from "@/api/client";
import type {
  ActivityEntry,
  Analytics,
  AppNotification,
  Book,
  BorrowRecord,
  Category,
  DashboardStats,
  Profile,
  Reservation,
  ScanResult,
  UserDetail,
} from "@/types";

export const apiBooks = {
  list: (params: { search?: string; category?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.category) q.set("category", params.category);
    return api<Book[]>(`/books${q.size ? `?${q}` : ""}`, { auth: false });
  },
  get: (id: number | string) => api<Book>(`/books/${id}`, { auth: false }),
  create: (payload: Partial<Book> & { categoryId?: number }) =>
    api<Book>("/books", { method: "POST", body: payload }),
  update: (id: number, payload: Partial<Book> & { categoryId?: number }) =>
    api<Book>(`/books/${id}`, { method: "PATCH", body: payload }),
  /** multipart PATCH — for cover image upload */
  updateWithCover: async (id: number, form: FormData): Promise<Book> => {
    const access = localStorage.getItem("lb_access");
    const res = await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Upload failed (${res.status})`);
    }
    return res.json();
  },
  remove: (id: number) => api<void>(`/books/${id}`, { method: "DELETE" }),
};

export const apiCategories = {
  list: () => api<Category[]>("/categories", { auth: false }),
  create: (payload: { name: string; color: string }) =>
    api<Category>("/categories", { method: "POST", body: payload }),
  update: (id: number, payload: { name?: string; color?: string }) =>
    api<Category>(`/categories/${id}`, { method: "PATCH", body: payload }),
  remove: (id: number) => api<void>(`/categories/${id}`, { method: "DELETE" }),
};

export const apiAuth = {
  register: (payload: {
    name: string; email: string; password: string; studentId: string;
    phoneNumber?: string; address?: string; staffInviteCode?: string;
  }) => api<Profile>("/auth/register", { method: "POST", body: payload, auth: false }),
  me: () => api<Profile>("/users/me"),
  idCardUrl: "/api/users/me/id-card",
  scan: (uuid: string) => api<ScanResult>(`/users/${uuid}/scan`),
};

export const apiRecords = {
  mine: () => api<BorrowRecord[]>("/borrow-records/mine"),
  list: (params: { status?: string; book?: number; user?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.book) q.set("book", String(params.book));
    if (params.user) q.set("user", String(params.user));
    return api<BorrowRecord[]>(`/borrow-records${q.size ? `?${q}` : ""}`);
  },
  create: (bookId: number) =>
    api<BorrowRecord>("/borrow-records", { method: "POST", body: { bookId } }),
  approve: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/approve`, { method: "POST" }),
  reject: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/reject`, { method: "POST" }),
  confirmPickup: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/confirm-pickup`, { method: "POST" }),
  confirmReturn: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/confirm-return`, { method: "POST" }),
  documentUrl: (id: number) => `/api/borrow-records/${id}/document`,
};

export const apiUsers = {
  list: (params: { search?: string; role?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    return api<Profile[]>(`/users${q.size ? `?${q}` : ""}`);
  },
  get: (id: number) => api<UserDetail>(`/users/${id}`),
  remove: (id: number) => api<void>(`/users/${id}/delete`, { method: "DELETE" }),
};

/** Download an authenticated binary (PDF) as a file. */
export async function downloadFile(url: string, filename: string) {
  const access = localStorage.getItem("lb_access");
  const res = await fetch(url, { headers: access ? { Authorization: `Bearer ${access}` } : {} });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(obj);
}

export const apiReservations = {
  mine: () => api<Reservation[]>("/reservations"),
  create: (bookId: number) => api<Reservation>("/reservations", { method: "POST", body: { bookId } }),
  forBook: (bookId: number) => api<Reservation[]>(`/books/${bookId}/reservations`),
  all: () => api<Reservation[]>("/reservations/all"),
};

export const apiMisc = {
  stats: () => api<DashboardStats>("/dashboard/stats"),
  analytics: () => api<Analytics>("/analytics"),
  activity: () => api<ActivityEntry[]>("/activity"),
  notifications: () => api<AppNotification[]>("/notifications/mine"),
  markRead: () => api<{ ok: boolean }>("/notifications/read", { method: "POST" }),
  runJobs: () => api<{ cancelled: number; flaggedOverdue: number }>("/jobs/run", { method: "POST" }),
};

/** Download the server-generated ID card PDF with the auth header attached. */
export async function downloadIdCard() {
  const access = localStorage.getItem("lb_access");
  const res = await fetch(apiAuth.idCardUrl, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  if (!res.ok) throw new Error("Could not generate ID card.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "libborrow-id-card.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
