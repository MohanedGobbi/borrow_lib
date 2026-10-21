import type { Lang } from "@/i18n/locales";

export type Role = "MEMBER" | "STAFF" | "ADMIN";

/** The kinds of reader (role MEMBER). */
export type MemberType = "STUDENT" | "PROFESSOR" | "ADMINISTRATIVE" | "EXTERNAL";
export const MEMBER_TYPES: MemberType[] = ["STUDENT", "PROFESSOR", "ADMINISTRATIVE", "EXTERNAL"];
/** What an account is, in one word: a kind of reader, a librarian (STAFF) or an administrator (ADMIN). */
export type AccountType = MemberType | "LIBRARIAN" | "ADMIN";
export const ACCOUNT_TYPES: AccountType[] = [...MEMBER_TYPES, "LIBRARIAN", "ADMIN"];

/** In-app notification groups a member can switch off, and the emails. A missing key means "on". */
export type NotificationGroup = "requests" | "waitingList" | "loans" | "overdue" | "announcements";
export const NOTIFICATION_GROUPS: NotificationGroup[] = ["requests", "waitingList", "loans", "overdue", "announcements"];
export type EmailKind = "ready" | "dueSoon" | "overdue";
export const EMAIL_KINDS: EmailKind[] = ["ready", "dueSoon", "overdue"];
export interface NotificationPrefs {
  inApp?: Partial<Record<NotificationGroup, boolean>>;
  email?: Partial<Record<EmailKind, boolean>>;
}

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
  isbn: string | null;
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
  /** Staff only: the loan to return when the book has exactly one active loan, and who has it. */
  activeLoanId?: number | null;
  activeLoanMember?: string | null;
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

export type StudentImportStatus = "create" | "exists" | "error";

/** One row of a bulk student import, as validated by the server. */
export interface StudentImportRow {
  row: number;
  status: StudentImportStatus;
  name: string;
  email: string;
  studentId: string;
  language: string;
  errors: ({ code: string } & Record<string, string | number>)[];
}

export interface StudentImportReport {
  dryRun: boolean;
  /** raw file header → field name, or null when the column is ignored */
  columns: Record<string, string | null>;
  missingColumns: string[];
  rows: StudentImportRow[];
  summary: Record<StudentImportStatus | "total", number>;
  /** Welcome emails that went out (0 in a preview). */
  emailsSent: number;
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
  memberType: MemberType;
  accountType: AccountType;
  membershipStartDate: string;
  /** The limit that applies: a personal override, or the default for the role. */
  maxBorrowLimit: number;
  /** True when the limit is the library default for the role, false for a personal override. */
  borrowLimitIsDefault: boolean;
  active: boolean;
  /** UI and email language of the account. */
  language: Lang;
  /** False until the member follows the link in the verification email; unverified members cannot borrow. */
  emailVerified: boolean;
  /** False when the member turned off pickup, due-date and overdue emails; notifications always stay on. */
  emailReminders: boolean;
  notificationPrefs: NotificationPrefs;
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
  /** True when the student withdrew the request or hold themselves (not staff, not the hold expiring). */
  cancelledByMember: boolean;
  /** Free copies of the book right now (on the shelf and not held for another pickup). */
  bookFreeCopies: number;
  memberHasOverdue: boolean;
  /** Title of the member's longest-overdue loan (what to return first); null without one. */
  memberOverdueTitle: string | null;
  memberActiveLoans: number;
  memberMaxBorrowLimit: number;
  /** How many times this loan has been renewed. */
  renewalCount: number;
  /** Someone is on the waiting list for the book, so the loan cannot be renewed. */
  bookHasQueue: boolean;
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
  /** English sentence, for rows without a code. */
  detail: string;
  /** Translatable event code (`pickup_confirmed`, …); empty on older rows. */
  code: string;
  params: Record<string, unknown>;
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

/** The circulation rules everyone can read (GET /api/settings). */
export interface LibraryRules {
  holdHours: number;
  loanDays: number;
  maxRenewals: number;
  /** A loan can be renewed only this many days before it is due. */
  renewWindowDays: number;
}

/** What admins see and edit: the public rules plus the borrow limits and reminder lead time. */
export interface LibrarySettings extends LibraryRules {
  memberBorrowLimit: number;
  staffBorrowLimit: number;
  reminderDaysBeforeDue: number;
  updatedAt: string;
  /** Name of the admin who last changed the rules; null until someone does. */
  updatedBy: string | null;
}

/** What the database holds, for the maintenance panel in Settings. */
export interface MaintenanceCounts {
  books: number;
  copies: number;
  categories: number;
  accounts: number;
  members: number;
  records: number;
  activeLoans: number;
  reservations: number;
  notifications: number;
  activity: number;
}

export type MaintenanceAction =
  | "reset-circulation" | "delete-catalogue" | "delete-members" | "clear-activity" | "reload-catalogue";

export type SettingsPatch = Partial<Pick<
  LibrarySettings,
  "holdHours" | "loanDays" | "maxRenewals" | "memberBorrowLimit" | "staffBorrowLimit" | "reminderDaysBeforeDue"
>>;

export type SiteImageSlot = "hero" | "feature" | "auth";

/** A photograph an admin set for one slot (GET /api/site-images). A slot with none shows the bundled photograph. */
export interface SiteImageData {
  /** The 1200-wide file. */
  src: string;
  /** "url 640w, url 1200w, url 2000w": only the widths that exist. */
  srcset: string;
  /** Size of the original upload, for the aspect ratio. */
  width: number;
  height: number;
  alt: Record<Lang, string>;
  credit: string;
  updatedAt: string;
}
export type SiteImages = Record<SiteImageSlot, SiteImageData | null>;

export const URGENT_PICKUP_MS = 6 * 60 * 60 * 1000;
export const DUE_SOON_DAYS = 3;
export const DUE_SOON_MS = DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
