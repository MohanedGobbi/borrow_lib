import type { Lang } from "@/i18n/locales";

export type Role = "MEMBER" | "STAFF" | "ADMIN";

export interface Page<T> {
  count: number;
  page: number;
  pageSize: number;
  results: T[];
}

export interface Category {
  id: number;
  name: string;
  color: string;
  bookCount?: number;
}

export type BorrowStatus =
  | "PENDING" | "READY" | "BORROWED" | "RETURNED" | "REJECTED" | "CANCELLED" | "OVERDUE";

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category: Category;
  publisher: string;
  year: number | null;
  totalCopies: number;
  availableCopies: number;
  freeCopies: number;
  shelfLocation: string;
  coverColor: string;
  coverImage: string | null;
  description: string;
}

/** One physical copy of a book and where it is right now. */
export interface BookCopy {
  copy: number;
  state: "ON_SHELF" | "HELD" | "BORROWED" | "OVERDUE";
  shelf?: string;
  dueDate?: string | null;
  since?: string | null;
  heldUntil?: string | null;
  /** staff only */
  recordId?: number;
  userName?: string;
  userProfileId?: number;
}

export type ImportStatus = "create" | "update" | "unchanged" | "skip" | "error";

/** One row of a bulk import, as validated by the server. */
export interface ImportRow {
  row: number;
  status: ImportStatus;
  isbn: string;
  title: string;
  author: string;
  totalCopies: number | null;
  errors: ({ code: string } & Record<string, string | number>)[];
  changes: string[];
}

export interface ImportReport {
  dryRun: boolean;
  /** raw file header → field name, or null when the column is ignored */
  columns: Record<string, string | null>;
  missingColumns: string[];
  newCategories?: string[];
  rows: ImportRow[];
  summary: Record<ImportStatus | "total" | "newCategories", number>;
}

export interface Profile {
  id: number;
  uuid: string;
  name: string;
  email: string;
  studentOrStaffId: string;
  phoneNumber: string;
  address: string;
  role: Role;
  membershipStartDate: string;
  maxBorrowLimit: number;
  active: boolean;
  /** UI and email language of the account. */
  language: Lang;
  /** False until the member follows the link in the verification email; unverified members cannot borrow. */
  emailVerified: boolean;
  activeLoans: number;
  hasOverdue: boolean;
}

/** A pending staff invitation (admins only). */
export interface StaffInvite {
  id: number;
  email: string;
  role: "STAFF" | "ADMIN";
  createdAt: string;
  expiresAt: string;
  createdBy: string | null;
}

/** The invite as first returned: `link` is shown once, in case the email bounces. */
export interface CreatedInvite extends StaffInvite {
  link: string;
}

/** A message the demo "sent". Demo builds have no mail server, so these are listed at /demo/mailbox. */
export interface DemoMail {
  id: number;
  to: string;
  subject: string;
  body: string;
  link: string;
  at: string;
}

export interface BorrowRecord {
  id: number;
  userId: number;
  userProfileId: number;
  bookId: number;
  userName: string;
  userIdNumber: string;
  bookTitle: string;
  bookShelf: string;
  requestedAt: string;
  approvedAt: string | null;
  pickupDeadline: string | null;
  borrowedAt: string | null;
  dueDate: string | null;
  returnedAt: string | null;
  status: BorrowStatus;
  /** Why staff rejected the request; empty when they gave no reason. */
  rejectionReason: string;
  /** Free copies of the book right now (on the shelf and not held for another pickup). */
  bookFreeCopies: number;
  memberHasOverdue: boolean;
  memberActiveLoans: number;
  memberMaxBorrowLimit: number;
}

export interface Reservation {
  id: number;
  userId: number;
  userProfileId: number;
  bookId: number;
  userName: string;
  bookTitle: string;
  reservedAt: string;
  isActive: boolean;
  position: number | null;
}

export interface ActivityEntry {
  id: number;
  at: string;
  actorName: string;
  action: string;
  detail: string;
}

export interface AppNotification {
  id: number;
  at: string;
  /** Translatable notification code (`request_approved`, …); empty on older rows. */
  code: string;
  params: Record<string, unknown>;
  /** English text, for rows without a code. */
  message: string;
  read: boolean;
}

export interface DashboardStats {
  totalBooks: number;
  totalBorrowed: number;
  totalReady: number;
  totalOverdue: number;
  totalMembers: number;
}

export interface UserDetail {
  member: Profile;
  records: BorrowRecord[];
}

export interface Analytics {
  statusDistribution: Partial<Record<BorrowStatus, number>>;
  categoryLoans: { name: string; color: string; loans: number }[];
  monthly: { month: string; loans: number; returns: number; newMembers: number }[];
  topBooks: { title: string; requests: number }[];
  activeReservations: number;
  fulfillmentRate: number;
}

export interface ScanResult {
  member: Profile;
  activeRecords: BorrowRecord[];
}

export const URGENT_PICKUP_MS = 6 * 60 * 60 * 1000;
export const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;
