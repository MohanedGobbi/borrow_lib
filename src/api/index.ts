import { api, authFetch, API_ROOT } from "@/api/client";
import type {
  ActivityEntry,
  Analytics,
  AppNotification,
  Book,
  BookCopy,
  ImportReport,
  BorrowRecord,
  Category,
  DashboardStats,
  Page,
  Profile,
  Reservation,
  ScanResult,
  UserDetail,
} from "@/types";

type PageParams = {
  page?: number;
  pageSize?: number;
  ordering?: string;
};

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    q.set(key, value === true ? "1" : String(value));
  }
  return q.size ? `?${q}` : "";
}

export const apiBooks = {
  list: (params: PageParams & {
    search?: string; category?: string; author?: string; isbn?: string; available?: boolean; ids?: number[];
  } = {}) => {
    const { ids, ...rest } = params;
    return api<Page<Book>>(`/books${query({ ...rest, ids: ids?.join(",") })}`, { auth: false });
  },
  get: (id: number | string) => api<Book>(`/books/${id}`, { auth: false }),
  /** Bulk import (staff). A dry run returns the preview without saving anything. */
  importRows: (body: { rows: Record<string, unknown>[]; mode: "skip" | "update"; dryRun: boolean; filename: string }) =>
    api<ImportReport>("/books/import", { method: "POST", body }),
  /** Where each copy is. Borrower names are included only for staff. */
  copies: (id: number | string) => api<BookCopy[]>(`/books/${id}/copies`),
  create: (payload: Partial<Book> & { categoryId?: number }) =>
    api<Book>("/books", { method: "POST", body: payload }),
  update: (id: number, payload: Partial<Book> & { categoryId?: number }) =>
    api<Book>(`/books/${id}`, { method: "PATCH", body: payload }),
  /** multipart PATCH — for cover image upload */
  updateWithCover: async (id: number, form: FormData): Promise<Book> => {
    const res = await authFetch(`${API_ROOT}/books/${id}`, { method: "PATCH", body: form });
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
  idCardUrl: `${API_ROOT}/users/me/id-card`,
  scan: (uuid: string) => api<ScanResult>(`/users/${uuid}/scan`),
};

export const apiRecords = {
  mine: () => api<BorrowRecord[]>("/borrow-records/mine"),
  list: (params: PageParams & { status?: string | string[]; book?: number; user?: number } = {}) => {
    const { status, ...rest } = params;
    return api<Page<BorrowRecord>>(
      `/borrow-records${query({ ...rest, status: Array.isArray(status) ? status.join(",") : status })}`,
    );
  },
  create: (bookId: number) =>
    api<BorrowRecord>("/borrow-records", { method: "POST", body: { bookId } }),
  approve: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/approve`, { method: "POST" }),
  reject: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/reject`, { method: "POST" }),
  confirmPickup: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/confirm-pickup`, { method: "POST" }),
  confirmReturn: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/confirm-return`, { method: "POST" }),
  documentUrl: (id: number) => `${API_ROOT}/borrow-records/${id}/document`,
};

export const apiUsers = {
  list: (params: PageParams & { search?: string; role?: string } = {}) =>
    api<Page<Profile>>(`/users${query(params)}`),
  get: (id: number) => api<UserDetail>(`/users/${id}`),
  remove: (id: number) => api<void>(`/users/${id}/delete`, { method: "DELETE" }),
};

/** Download an authenticated binary (PDF) as a file. */
export async function downloadFile(url: string, filename: string) {
  const res = await authFetch(url);
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
  const res = await authFetch(apiAuth.idCardUrl);
  if (!res.ok) throw new Error("Could not generate ID card.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "libborrow-id-card.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
