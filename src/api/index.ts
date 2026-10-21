import { api, ApiError, authFetch, API_ROOT } from "@/api/client";
import type { Lang } from "@/i18n/locales";
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
  LibraryRules,
  LibrarySettings,
  MaintenanceAction,
  MaintenanceCounts,
  MemberType,
  AccountType,
  NotificationPrefs,
  Page,
  Profile,
  Reservation,
  StudentImportReport,
  CreatedInvite,
  ScanResult,
  SettingsPatch,
  SiteImageData,
  SiteImageSlot,
  SiteImages,
  StaffInvite,
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
  } = {}, opts: { auth?: boolean } = {}) => {
    const { ids, ...rest } = params;
    // Public by default. Staff pass `auth` to also get `activeLoanId` (the loan to return) on each book.
    return api<Page<Book>>(`/books${query({ ...rest, ids: ids?.join(",") })}`, { auth: opts.auth ?? false });
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
    name: string; email: string; password: string; phoneNumber: string;
    memberType?: MemberType; language?: Lang; inviteToken?: string;
  }) => api<Profile>("/auth/register", { method: "POST", body: payload, auth: false }),
  me: () => api<Profile>("/users/me"),
  /** The member's master switch for pickup, due-date and overdue emails. */
  setEmailReminders: (emailReminders: boolean) =>
    api<Profile>("/users/me", { method: "PATCH", body: { emailReminders } }),
  /** Which notifications the member receives; only the keys sent change. */
  setNotificationPrefs: (notificationPrefs: NotificationPrefs) =>
    api<Profile>("/users/me", { method: "PATCH", body: { notificationPrefs } }),
  /** Fire-and-forget from the language switcher; the server uses it for emails. */
  setLanguage: (language: Lang) => api<Profile>("/users/me", { method: "PATCH", body: { language } }),
  requestPasswordReset: (email: string) =>
    api<void>("/auth/password-reset", { method: "POST", body: { email }, auth: false }),
  resetPassword: (payload: { uid: string; token: string; password: string }) =>
    api<void>("/auth/password-reset/confirm", { method: "POST", body: payload, auth: false }),
  verifyEmail: (payload: { uid: string; token: string }) =>
    api<void>("/auth/verify-email", { method: "POST", body: payload, auth: false }),
  resendVerification: () => api<void>("/auth/verify-email/resend", { method: "POST" }),
  idCardUrl: `${API_ROOT}/users/me/id-card`,
  scan: (uuid: string) => api<ScanResult>(`/users/${uuid}/scan`),
};

/** Options for the actions that can be sent as the page unloads. */
type SendOptions = { keepalive?: boolean };

export const apiRecords = {
  mine: () => api<BorrowRecord[]>("/borrow-records/mine"),
  list: (params: PageParams & { status?: string | string[]; book?: number; user?: number; search?: string; dueBefore?: string } = {}) => {
    const { status, dueBefore, ...rest } = params;
    return api<Page<BorrowRecord>>(
      `/borrow-records${query({ ...rest, status: Array.isArray(status) ? status.join(",") : status, due_before: dueBefore })}`,
    );
  },
  create: (bookId: number) =>
    api<BorrowRecord>("/borrow-records", { method: "POST", body: { bookId } }),
  /** The student takes back their own pending request or ready hold. */
  withdraw: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/withdraw`, { method: "POST" }),
  approve: (id: number, opts: SendOptions = {}) =>
    api<BorrowRecord>(`/borrow-records/${id}/approve`, { method: "POST", ...opts }),
  /** The reason (up to 300 characters) is optional and is shown to the student. */
  reject: (id: number, reason = "") =>
    api<BorrowRecord>(`/borrow-records/${id}/reject`, { method: "POST", body: { reason } }),
  confirmPickup: (id: number, opts: SendOptions = {}) =>
    api<BorrowRecord>(`/borrow-records/${id}/confirm-pickup`, { method: "POST", ...opts }),
  confirmReturn: (id: number, opts: SendOptions = {}) =>
    api<BorrowRecord>(`/borrow-records/${id}/confirm-return`, { method: "POST", ...opts }),
  /** The borrower renews their own loan; staff may renew on a member's behalf. */
  renew: (id: number) => api<BorrowRecord>(`/borrow-records/${id}/renew`, { method: "POST" }),
  documentUrl: (id: number) => `${API_ROOT}/borrow-records/${id}/document`,
};

export const apiSettings = {
  /** Everyone gets the public rules; a signed-in admin gets the full settings. */
  get: () => api<LibraryRules | LibrarySettings>("/settings"),
  update: (patch: SettingsPatch) => api<LibrarySettings>("/settings", { method: "PATCH", body: patch }),
};

export const apiSiteImages = {
  /** Public: a slot is null until an admin replaces the bundled photograph. */
  get: () => api<SiteImages>("/site-images", { auth: false }),
  /** Admin: multipart with file, altEn, altFr, altAr and credit. */
  replace: (slot: SiteImageSlot, form: FormData) =>
    api<SiteImageData>(`/site-images/${slot}`, { method: "PUT", body: form }),
  /** Admin: remove the custom photograph, so the slot shows the bundled one again. */
  restore: (slot: SiteImageSlot) => api<void>(`/site-images/${slot}`, { method: "DELETE" }),
};

export const apiInvites = {
  /** Pending invites (admins only). */
  list: () => api<StaffInvite[]>("/invites"),
  create: (payload: { email: string; role: "STAFF" | "ADMIN" }) =>
    api<CreatedInvite>("/invites", { method: "POST", body: payload }),
  revoke: (id: number) => api<void>(`/invites/${id}`, { method: "DELETE" }),
  /** Public: which address and role a signup link is for. 404 when it is used, revoked or expired. */
  lookup: (token: string) =>
    api<{ email: string; role: "STAFF" | "ADMIN" }>(`/invites/lookup${query({ token })}`, { auth: false }),
};

export const apiUsers = {
  /** Bulk student import (admin). A dry run returns the preview without saving or emailing anything. */
  importRows: (body: { rows: Record<string, unknown>[]; dryRun: boolean; filename: string }) =>
    api<StudentImportReport>("/users/import", { method: "POST", body }),
  list: (params: PageParams & { search?: string; role?: string; accountType?: string } = {}) =>
    api<Page<Profile>>(`/users${query(params)}`),
  get: (id: number) => api<UserDetail>(`/users/${id}`),
  remove: (id: number) => api<void>(`/users/${id}/delete`, { method: "DELETE" }),
  /** Admin: an account of any type. Without a password the person gets an email to choose one. */
  create: (payload: {
    name: string; email: string; phoneNumber: string; accountType: AccountType; password?: string; language?: Lang;
  }) => api<Profile>("/users", { method: "POST", body: payload }),
  setAccountType: (id: number, accountType: AccountType) =>
    api<Profile>(`/users/${id}/role`, { method: "PATCH", body: { accountType } }),
  setActive: (id: number, active: boolean) =>
    api<Profile>(`/users/${id}/active`, { method: "PATCH", body: { active } }),
};

export const apiMaintenance = {
  counts: () => api<MaintenanceCounts>("/maintenance"),
  /** Every action asks for the admin's password again. */
  run: (action: MaintenanceAction, password: string) =>
    api<{ result: unknown; counts: MaintenanceCounts }>(`/maintenance/${action}`, { method: "POST", body: { password } }),
  restore: (file: File, password: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("password", password);
    return api<MaintenanceCounts>("/maintenance/restore", { method: "POST", body });
  },
  backup: () => downloadExport("/maintenance/backup", {}, `library-backup-${today()}.json`),
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

export type ExportFormat = "csv" | "xlsx";

/** Download an authenticated spreadsheet export (staff). The server names the file; `fallback` is used when it does not. */
async function downloadExport(path: string, params: Record<string, string | undefined>, fallback: string) {
  const res = await authFetch(`${API_ROOT}${path}${query(params)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail || `Export failed (${res.status})`, [], { code: data.code, params: data.params });
  }
  const named = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = named ?? fallback;
  a.click();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

export const apiExports = {
  /** The whole catalogue (or the filtered part) in the import format. */
  books: (format: ExportFormat, filters: { search?: string; category?: string } = {}) =>
    downloadExport("/exports/books", { format, ...filters }, `library-books-${today()}.${format}`),
  /** Borrow records; `from` / `to` are YYYY-MM-DD dates on the request date, `status` a list of statuses. */
  loans: (format: ExportFormat, filters: { status?: string[]; from?: string; to?: string } = {}) =>
    downloadExport("/exports/loans", {
      format, status: filters.status?.join(","), from: filters.from, to: filters.to,
    }, `library-loans-${today()}.${format}`),
};

export const apiReservations = {
  mine: () => api<Reservation[]>("/reservations"),
  create: (bookId: number) => api<Reservation>("/reservations", { method: "POST", body: { bookId } }),
  /** The student leaves a waiting list; everyone behind moves up. */
  leave: (id: number) => api<void>(`/reservations/${id}`, { method: "DELETE" }),
  forBook: (bookId: number) => api<Reservation[]>(`/books/${bookId}/reservations`),
  all: () => api<Reservation[]>("/reservations/all"),
};

export const apiMisc = {
  stats: () => api<DashboardStats>("/dashboard/stats"),
  analytics: () => api<Analytics>("/analytics"),
  activity: () => api<ActivityEntry[]>("/activity"),
  notifications: () => api<AppNotification[]>("/notifications/mine"),
  markRead: () => api<{ ok: boolean }>("/notifications/read", { method: "POST" }),
  /** Staff: a message to the readers chosen by account type and/or one by one (profile ids). */
  sendNotification: (body: { message: string; accountTypes: AccountType[]; userIds: number[] }) =>
    api<{ sent: number }>("/notifications/send", { method: "POST", body }),
  runJobs: () => api<{ cancelled: number; flaggedOverdue: number; remindersSent: number }>("/jobs/run", { method: "POST" }),
};

/** Download the server-generated ID card PDF with the auth header attached. */
export async function downloadIdCard() {
  const res = await authFetch(apiAuth.idCardUrl);
  if (!res.ok) throw new Error("Could not generate ID card.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "library-card.pdf";
  a.click();
  URL.revokeObjectURL(url);
}
