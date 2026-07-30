export type Role = "MEMBER" | "STAFF" | "ADMIN";

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
  shelfLocation: string;
  coverColor: string;
  coverImage: string | null;
  description: string;
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
  activeLoans: number;
  hasOverdue: boolean;
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

export const STATUS_LABEL: Record<BorrowStatus, string> = {
  PENDING: "Pending",
  READY: "Ready for pickup",
  BORROWED: "Borrowed",
  RETURNED: "Returned",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
};

export const URGENT_PICKUP_MS = 6 * 60 * 60 * 1000;
export const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;
