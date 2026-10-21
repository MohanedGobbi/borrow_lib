import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Query keys, one factory so every invalidation names exactly what it means. */
export const qk = {
  books: {
    all: ["books"] as const,
    list: (p: object) => ["books", "list", p] as const,
    detail: (id: number | string) => ["books", "detail", String(id)] as const,
    copies: (id: number | string) => ["books", "copies", String(id)] as const,
  },
  categories: { all: ["categories"] as const },
  records: {
    all: ["records"] as const,
    list: (p: object) => ["records", "list", p] as const,
    mine: ["records", "mine"] as const,
  },
  reservations: {
    all: ["reservations"] as const,
    list: ["reservations", "list"] as const,
    mine: ["reservations", "mine"] as const,
    forBook: (id: number | string) => ["reservations", "book", String(id)] as const,
  },
  users: {
    all: ["users"] as const,
    list: (p: object) => ["users", "list", p] as const,
    detail: (id: number | string) => ["users", "detail", String(id)] as const,
    scan: (uuid: string) => ["users", "scan", uuid] as const,
  },
  stats: ["stats"] as const,
  analytics: ["analytics"] as const,
  activity: ["activity"] as const,
  notifications: ["notifications"] as const,
  invites: ["invites"] as const,
  settings: ["settings"] as const,
  siteImages: ["siteImages"] as const,
  maintenance: ["maintenance"] as const,
};

/** Marks every query under these keys stale and refetches the ones on screen. */
function invalidateAll(qc: QueryClient, keys: readonly QueryKey[]) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/**
 * A request, approval, pickup, return, reservation or the hourly jobs ran. Besides the lists
 * themselves this changes free copies, queues, the sidebar counts, the staff overview, the
 * activity log and each member's loans.
 */
export const invalidateCirculation = (qc: QueryClient) =>
  invalidateAll(qc, [
    qk.records.all, qk.books.all, qk.reservations.all, qk.users.all,
    qk.stats, qk.analytics, qk.activity, qk.notifications,
  ]);

/** A book or category was added, edited, imported or deleted. Loans and queues carry the book's title and shelf. */
export const invalidateCatalog = (qc: QueryClient) =>
  invalidateAll(qc, [
    qk.books.all, qk.categories.all, qk.records.all, qk.reservations.all, qk.stats, qk.analytics, qk.activity,
  ]);

/** The circulation rules changed: the copy that quotes them, and the activity log that records the change. */
export const invalidateSettings = (qc: QueryClient) => invalidateAll(qc, [qk.settings, qk.activity]);

/** A site photograph was replaced or restored: the pictures themselves, and the activity log that records it. */
export const invalidateSiteImages = (qc: QueryClient) => invalidateAll(qc, [qk.siteImages, qk.activity]);

export const invalidateInvites = (qc: QueryClient) => invalidateAll(qc, [qk.invites]);
export const invalidateNotifications = (qc: QueryClient) => invalidateAll(qc, [qk.notifications]);
export const invalidateUsers = (qc: QueryClient) => invalidateAll(qc, [qk.users.all, qk.stats, qk.activity]);
