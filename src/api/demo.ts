/**
 * In-browser stand-in for the Django API, used by static demo builds
 * (`npm run build:demo`, e.g. on Vercel). It answers the same `/api/...`
 * routes with the same JSON shapes and enforces the same business rules as
 * backend/library/services.py. State is seeded from the `seed_demo` dataset
 * and persisted to localStorage so the demo survives reloads.
 */
import { CSRF_HEADER, DEMO_REFRESH_KEY, DEMO_STORAGE_KEY as STORAGE_KEY } from "@/api/client";
import type { Lang } from "@/i18n/locales";
import type { BorrowStatus, Role } from "@/types";

type SiteSlot = "hero" | "feature" | "auth";
const SITE_SLOTS: SiteSlot[] = ["hero", "feature", "auth"];

const PASSWORD = "password123";
// The library's name per language (mirrors emails.LIBRARY_NAMES); the French sentences put "la" before it.
const LIBRARY_NAMES: Record<Lang, string> = {
  en: "University of Ghardaia Library",
  fr: "Bibliothèque de l'Université de Ghardaïa",
  ar: "مكتبة جامعة غرداية",
};
const H = 60 * 60 * 1000;
const D = 24 * H;
/** A loan can be renewed only this close to its due date (services.RENEW_WINDOW_DAYS). */
const RENEW_WINDOW_DAYS = 3;
const REJECTION_REASON_MAX = 300;
const ACTIVE: BorrowStatus[] = ["PENDING", "READY", "BORROWED", "OVERDUE"];

interface DCategory { id: number; name: string; color: string }
interface DBook {
  id: number; title: string; author: string; isbn: string; categoryId: number; publisher: string;
  year: number | null; totalCopies: number; availableCopies: number; shelfLocation: string;
  coverColor: string; coverImage: string | null; description: string;
}
interface DUser {
  id: number; uuid: string; name: string; email: string; password: string; idNumber: string;
  phone: string; address: string; role: Role; since: number; active: boolean;
  /** A personal override; null means "the default for my role" from the settings. */
  maxLimit: number | null;
  language: Lang; emailVerified: boolean;
  /** Opted in to the ready / due-soon / overdue emails (anything but false counts as on). */
  emailReminders?: boolean;
  /** Refresh tokens issued before this moment are dead (set by a password reset). */
  sessionsRevokedAt?: number;
}
interface DRecord {
  id: number; userId: number; bookId: number; requestedAt: number; approvedAt: number | null;
  pickupDeadline: number | null; borrowedAt: number | null; dueDate: number | null;
  returnedAt: number | null; status: BorrowStatus;
  /** Why staff rejected the request (max 300 characters); shown to the member. */
  rejectionReason?: string;
  /** True when the member withdrew the request or hold themselves. */
  cancelledByMember?: boolean;
  /** How many times the loan has been renewed. */
  renewalCount?: number;
  /** One email per event per record: each is set only after the email went out (a renewal clears the due one). */
  readyEmailSentAt?: number | null;
  dueReminderSentAt?: number | null;
  overdueEmailSentAt?: number | null;
}
interface DSettings {
  holdHours: number; loanDays: number; maxRenewals: number; memberBorrowLimit: number;
  staffBorrowLimit: number; reminderDaysBeforeDue: number;
  updatedAt: number; updatedBy: number | null;
}
/** A photograph an admin set (SiteImage): WebP data URLs at 1200 and 640 only, to keep localStorage small. */
interface DSiteImage {
  src1200: string; src640: string; width: number; height: number;
  altEn: string; altFr: string; altAr: string; credit: string; updatedAt: number;
}
interface DReservation { id: number; userId: number; bookId: number; reservedAt: number; isActive: boolean }
interface DActivity {
  id: number; at: number; actorName: string; action: string; detail: string;
  /** Translation key suffix and placeholders (rows saved before D2b have neither and show `detail`). */
  code?: string; params?: Record<string, unknown>;
}
interface DNotification {
  id: number; userId: number; at: number; code: string; params: Record<string, unknown>; message: string; read: boolean;
}
interface DEmailToken { token: string; kind: "reset" | "verify"; userId: number; expiresAt: number; used: boolean }
interface DInvite {
  id: number; email: string; role: "STAFF" | "ADMIN"; token: string; createdBy: number;
  createdAt: number; expiresAt: number; usedAt: number | null; revokedAt: number | null;
}
interface DMail { id: number; to: string; subject: string; body: string; link: string; at: number }

interface DemoState {
  seq: number;
  /** The circulation rules an admin can change (LibrarySettings). */
  settings: DSettings;
  categories: DCategory[];
  books: DBook[];
  users: DUser[];
  records: DRecord[];
  reservations: DReservation[];
  activity: DActivity[];
  notifications: DNotification[];
  /** Rotated or signed-out refresh tokens, like Django's token blacklist. */
  revokedTokens: string[];
  emailTokens: DEmailToken[];
  invites: DInvite[];
  /** Everything the demo "sent", newest first (the real app emails it). */
  outbox: DMail[];
  /** Photographs admins replaced, by slot; a missing slot shows the bundled photograph. */
  siteImages: Partial<Record<SiteSlot, DSiteImage>>;
}

// ------------------------------- seed -------------------------------

const CATEGORY_COLORS: [string, string][] = [
  ["Fiction", "#1F6E43"], ["Non-Fiction", "#8A5A2B"], ["Science", "#2D5F7A"],
  ["History", "#645B7C"], ["Technology", "#4A5560"],
];

type SeedBook = [string, string, string, string, string, number, number, number, string, string, string];
const BOOKS: SeedBook[] = [
  ["The Name of the Wind", "Patrick Rothfuss", "978-0756404741", "Fiction", "DAW Books", 2007, 4, 2, "FIC-A-03", "#1F4D3A", "The riveting first-person narrative of Kvothe, a gifted young man who grows to be the most notorious magician his world has ever seen."],
  ["Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "978-0062316097", "History", "Harper", 2015, 5, 3, "HIS-B-11", "#5C4630", "A groundbreaking narrative of humanity's creation and evolution."],
  ["Clean Code", "Robert C. Martin", "978-0132350884", "Technology", "Prentice Hall", 2008, 3, 0, "TEC-C-07", "#2E4A3C", "A handbook of agile software craftsmanship."],
  ["A Brief History of Time", "Stephen Hawking", "978-0553380163", "Science", "Bantam", 1998, 3, 1, "SCI-D-02", "#4A4E45", "From the Big Bang to black holes — a landmark volume in science writing."],
  ["The Design of Everyday Things", "Don Norman", "978-0465050659", "Non-Fiction", "Basic Books", 2013, 2, 2, "NON-E-05", "#7A3B2E", "The classic guide to human-centered design."],
  ["Dune", "Frank Herbert", "978-0441172719", "Fiction", "Ace", 1990, 6, 4, "FIC-A-09", "#2B3F52", "Set on the desert planet Arrakis, the story of Paul Atreides."],
  ["The Pragmatic Programmer", "David Thomas & Andrew Hunt", "978-0135957059", "Technology", "Addison-Wesley", 2019, 3, 1, "TEC-C-02", "#3D3A4F", "Your journey to mastery: classic software development wisdom."],
  ["Guns, Germs, and Steel", "Jared Diamond", "978-0393354324", "History", "W. W. Norton", 2017, 2, 0, "HIS-B-04", "#6E2A2A", "A global account of the rise of civilization."],
  ["The Selfish Gene", "Richard Dawkins", "978-0198788607", "Science", "Oxford UP", 2016, 3, 2, "SCI-D-08", "#29463F", "The gene-centered view of evolution that changed biology."],
  ["Thinking, Fast and Slow", "Daniel Kahneman", "978-0374533557", "Non-Fiction", "FSG", 2013, 4, 3, "NON-E-01", "#1F4D3A", "The two systems that drive the way we think."],
  ["Structure and Interpretation of Computer Programs", "Harold Abelson & Gerald Jay Sussman", "978-0262510875", "Technology", "MIT Press", 1996, 2, 2, "TEC-C-11", "#5C4630", "The wizard book: a deep introduction to programming using Scheme."],
  ["The Silk Roads", "Peter Frankopan", "978-1101912379", "History", "Vintage", 2017, 2, 1, "HIS-B-15", "#2E4A3C", "A new history of the world told through trade networks."],
  ["Klara and the Sun", "Kazuo Ishiguro", "978-0593318171", "Fiction", "Vintage", 2021, 3, 1, "FIC-A-14", "#4A4E45", "The story of Klara, an Artificial Friend."],
  ["The Gene: An Intimate History", "Siddhartha Mukherjee", "978-1476733524", "Science", "Scribner", 2017, 2, 0, "SCI-D-12", "#7A3B2E", "A magnificent history of the gene."],
  ["Atomic Habits", "James Clear", "978-0735211292", "Non-Fiction", "Avery", 2018, 5, 4, "NON-E-09", "#2B3F52", "Tiny changes, remarkable results."],
  ["The Art of Computer Programming, Vol. 1", "Donald E. Knuth", "978-0201896831", "Technology", "Addison-Wesley", 1997, 1, 1, "TEC-C-15", "#3D3A4F", "Fundamental algorithms — the bible of computer science."],
  ["Meditations", "Marcus Aurelius", "978-0812968255", "Non-Fiction", "Modern Library", 2002, 3, 3, "NON-E-13", "#6E2A2A", "Timeless Stoic wisdom on duty and mortality."],
  ["Project Hail Mary", "Andy Weir", "978-0593135228", "Fiction", "Ballantine", 2021, 4, 0, "FIC-A-20", "#29463F", "A lone astronaut with the fate of humanity on his shoulders."],
  ["ثلاثية غرناطة", "رضوى عاشور", "978-9770930212", "Fiction", "دار الشروق", 1994, 3, 3, "FIC-A-22", "#2E4A3C", "رواية تاريخية تتبع عائلة أندلسية عبر سقوط غرناطة وما تلاه من محنة وصمود."],
  ["مقدمة ابن خلدون", "عبد الرحمن بن خلدون", "978-9770915103", "History", "دار الفكر", 2004, 2, 2, "HIS-B-18", "#5C4630", "العمل الذي أسّس علم العمران، يدرس قيام الدول وسقوطها وتحوّلات المجتمعات."],
  ["L'Étranger", "Albert Camus", "978-2070360024", "Fiction", "Gallimard", 1972, 3, 3, "FIC-A-23", "#4A4E45", "Le roman de Meursault, un homme en marge, devant le soleil d'Alger et devant la justice."],
];

/** Interface language per seeded account; everyone else uses English. */
const SEED_LANGUAGES: Record<string, Lang> = {
  "staff@libborrow.dev": "fr", "youssef@example.com": "ar", "amira@example.com": "ar",
  "lucas@example.com": "fr", "ines@example.com": "fr", "lea@example.com": "fr",
  "karim@example.com": "ar", "tomas@example.com": "fr",
};

const USERS: [string, string, string, Role, number][] = [
  ["Eleanor Vance", "admin@libborrow.dev", "STF-0001", "ADMIN", 2700],
  ["Marcus Holloway", "staff@libborrow.dev", "STF-0042", "STAFF", 1600],
  ["Priya Sharma", "priya@example.com", "STU-10293", "MEMBER", 700],
  ["Daniel Okafor", "daniel@example.com", "STU-10417", "MEMBER", 560],
  ["Sofia Lindqvist", "sofia@example.com", "STU-10558", "MEMBER", 150],
  ["Tomás Rivera", "tomas@example.com", "STU-10660", "MEMBER", 95],
  ["Hana Yoshida", "hana@example.com", "STU-10774", "MEMBER", 40],
  ["Greta Weiss", "gweiss@libborrow.dev", "STF-0057", "STAFF", 1250],
  ["Youssef Ben Ali", "youssef@example.com", "STU-10801", "MEMBER", 210],
  ["Amira Haddad", "amira@example.com", "STU-10802", "MEMBER", 180],
  ["Lucas Martin", "lucas@example.com", "STU-10803", "MEMBER", 260],
  ["Inès Moreau", "ines@example.com", "STU-10804", "MEMBER", 120],
  ["Karim Mansour", "karim@example.com", "STU-10805", "MEMBER", 75],
  ["Léa Dubois", "lea@example.com", "STU-10806", "MEMBER", 300],
  ["Omar Trabelsi", "omar@example.com", "STU-10807", "MEMBER", 55],
  ["Sara Khalil", "sara@example.com", "STU-10808", "MEMBER", 20],
];

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function seed(): DemoState {
  const now = Date.now();
  const s: DemoState = {
    seq: 1000,
    settings: {
      holdHours: 48, loanDays: 14, maxRenewals: 1, memberBorrowLimit: 5, staffBorrowLimit: 10,
      reminderDaysBeforeDue: 2, updatedAt: now, updatedBy: null,
    },
    categories: [], books: [], users: [], records: [], reservations: [], activity: [], notifications: [], revokedTokens: [],
    emailTokens: [], invites: [], outbox: [], siteImages: {},
  };
  CATEGORY_COLORS.forEach(([name, color], i) => s.categories.push({ id: i + 1, name, color }));
  BOOKS.forEach(([title, author, isbn, cat, publisher, year, total, avail, shelf, color, description], i) =>
    s.books.push({
      id: i + 1, title, author, isbn, categoryId: s.categories.find((c) => c.name === cat)!.id,
      publisher, year, totalCopies: total, availableCopies: avail, shelfLocation: shelf,
      coverColor: color, coverImage: null, description,
    }));
  USERS.forEach(([name, email, idNumber, role, sinceDays], i) =>
    s.users.push({
      id: i + 1, uuid: uuid(), name, email, password: PASSWORD, idNumber,
      phone: `+1 555 010 ${idNumber.slice(-4)}`, address: "", role,
      since: now - sinceDays * D, maxLimit: null, active: true,
      language: SEED_LANGUAGES[email] ?? "en", emailVerified: true, emailReminders: true,
    }));

  const u = (email: string) => s.users.find((x) => x.email === email)!.id;
  const b = (title: string) => s.books.find((x) => x.title === title)!.id;
  const [priya, daniel, sofia, tomas, hana] =
    ["priya@example.com", "daniel@example.com", "sofia@example.com", "tomas@example.com", "hana@example.com"].map(u);

  let rid = 0;
  const rec = (userId: number, title: string, status: BorrowStatus, o: Partial<Record<keyof DRecord, number>>) =>
    s.records.push({
      id: ++rid, userId, bookId: b(title), status,
      requestedAt: now + (o.requestedAt ?? 0),
      approvedAt: o.approvedAt != null ? now + o.approvedAt : null,
      pickupDeadline: o.pickupDeadline != null ? now + o.pickupDeadline : null,
      borrowedAt: o.borrowedAt != null ? now + o.borrowedAt : null,
      dueDate: o.dueDate != null ? now + o.dueDate : null,
      returnedAt: o.returnedAt != null ? now + o.returnedAt : null,
      // Seeded holds and overdue loans count as already announced, so the first job run stays quiet.
      readyEmailSentAt: status === "READY" ? now : null,
      overdueEmailSentAt: status === "OVERDUE" ? now : null,
    });

  rec(priya, "A Brief History of Time", "PENDING", { requestedAt: -5 * H });
  rec(tomas, "The Pragmatic Programmer", "PENDING", { requestedAt: -26 * H });
  rec(hana, "The Name of the Wind", "PENDING", { requestedAt: -2 * H });
  rec(sofia, "Atomic Habits", "PENDING", { requestedAt: -40 * H });
  rec(daniel, "Thinking, Fast and Slow", "READY", { requestedAt: -50 * H, approvedAt: -46 * H, pickupDeadline: 2 * H });
  rec(priya, "Sapiens: A Brief History of Humankind", "READY", { requestedAt: -10 * H, approvedAt: -8 * H, pickupDeadline: 40 * H });
  rec(tomas, "The Silk Roads", "READY", { requestedAt: -30 * H, approvedAt: -43 * H, pickupDeadline: 5 * H });
  rec(sofia, "Dune", "BORROWED", { requestedAt: -13 * D, approvedAt: -12.8 * D, pickupDeadline: -10.8 * D, borrowedAt: -12 * D, dueDate: 2 * D });
  rec(hana, "Klara and the Sun", "BORROWED", { requestedAt: -6 * D, approvedAt: -5.9 * D, pickupDeadline: -3.9 * D, borrowedAt: -5 * D, dueDate: 9 * D });
  rec(priya, "The Selfish Gene", "BORROWED", { requestedAt: -8 * D, approvedAt: -7.8 * D, pickupDeadline: -5.8 * D, borrowedAt: -7 * D, dueDate: 7 * D });
  rec(daniel, "The Name of the Wind", "OVERDUE", { requestedAt: -20 * D, approvedAt: -19.8 * D, pickupDeadline: -17.8 * D, borrowedAt: -19 * D, dueDate: -5 * D });
  rec(tomas, "The Design of Everyday Things", "OVERDUE", { requestedAt: -18 * D, approvedAt: -17.9 * D, pickupDeadline: -15.9 * D, borrowedAt: -17 * D, dueDate: -3 * D });
  rec(priya, "Dune", "RETURNED", { requestedAt: -40 * D, approvedAt: -39.8 * D, pickupDeadline: -37.8 * D, borrowedAt: -39 * D, dueDate: -25 * D, returnedAt: -28 * D });
  rec(sofia, "Thinking, Fast and Slow", "RETURNED", { requestedAt: -35 * D, approvedAt: -34.8 * D, pickupDeadline: -32.8 * D, borrowedAt: -34 * D, dueDate: -20 * D, returnedAt: -22 * D });
  rec(tomas, "The Art of Computer Programming, Vol. 1", "REJECTED", { requestedAt: -9 * D });
  rec(daniel, "Clean Code", "CANCELLED", { requestedAt: -6 * D, approvedAt: -5.8 * D, pickupDeadline: -3.8 * D });

  // Students holding the remaining copies, so every copy that is off the shelf has a borrower.
  const loan = (email: string, title: string, daysAgo: number) =>
    rec(u(email), title, "BORROWED", {
      requestedAt: -(daysAgo + 1) * D, approvedAt: -(daysAgo + 0.8) * D, pickupDeadline: -(daysAgo - 1.2) * D,
      borrowedAt: -daysAgo * D, dueDate: (14 - daysAgo) * D,
    });
  loan("youssef@example.com", "Project Hail Mary", 3);
  loan("amira@example.com", "Project Hail Mary", 6);
  loan("lucas@example.com", "Project Hail Mary", 9);
  loan("ines@example.com", "Project Hail Mary", 12);
  loan("karim@example.com", "Clean Code", 2);
  loan("lea@example.com", "Clean Code", 8);
  loan("omar@example.com", "Clean Code", 11);
  loan("sara@example.com", "Guns, Germs, and Steel", 4);
  loan("youssef@example.com", "Guns, Germs, and Steel", 10);
  loan("amira@example.com", "The Gene: An Intimate History", 5);
  loan("karim@example.com", "The Gene: An Intimate History", 13);
  loan("lucas@example.com", "The Name of the Wind", 7);
  loan("ines@example.com", "Sapiens: A Brief History of Humankind", 2);
  loan("omar@example.com", "Sapiens: A Brief History of Humankind", 6);
  loan("lea@example.com", "A Brief History of Time", 4);
  loan("sara@example.com", "A Brief History of Time", 9);
  loan("karim@example.com", "Dune", 1);
  loan("omar@example.com", "The Pragmatic Programmer", 3);
  loan("youssef@example.com", "The Pragmatic Programmer", 12);
  loan("amira@example.com", "Thinking, Fast and Slow", 8);
  loan("lucas@example.com", "The Silk Roads", 5);
  loan("sara@example.com", "Klara and the Sun", 10);
  loan("ines@example.com", "Atomic Habits", 7);

  // Shelf stock is derived from the loans, never typed in: available = total − copies on loan.
  for (const book of s.books) {
    const out = s.records.filter((r) => r.bookId === book.id && (r.status === "BORROWED" || r.status === "OVERDUE")).length;
    book.availableCopies = Math.max(0, book.totalCopies - out);
  }

  ([[sofia, "Clean Code"], [hana, "Clean Code"], [priya, "Guns, Germs, and Steel"],
    [daniel, "Project Hail Mary"], [tomas, "Project Hail Mary"]] as [number, string][])
    .forEach(([userId, title], i) =>
      s.reservations.push({ id: i + 1, userId, bookId: b(title), reservedAt: now - (5 - i) * H, isActive: true }));

  // Replay the seeded records into the activity log so the staff desk shows a real trail.
  const staffName = "Marcus Holloway";
  const name = (id: number) => s.users.find((x) => x.id === id)!.name;
  const title = (id: number) => s.books.find((x) => x.id === id)!.title;
  let aid = 0;
  const trail = (at: number | null, actorName: string, action: string, detail: string, params: Record<string, unknown>) => {
    if (at != null) s.activity.push({ id: ++aid, at, actorName, action, detail, code: action.toLowerCase(), params });
  };
  for (const r of s.records) {
    const who = name(r.userId);
    const what = title(r.bookId);
    const p = { member: who, title: what };
    trail(r.requestedAt, who, "REQUEST_CREATED", `${who} requested “${what}”.`, p);
    if (r.status === "REJECTED") trail(r.requestedAt + 3 * H, staffName, "REJECTED", `Rejected ${who}'s request for “${what}”.`, p);
    trail(r.approvedAt, staffName, "APPROVED", `Approved ${who}'s request for “${what}”. Pickup within 48h.`, { ...p, hours: 48 });
    if (r.status === "CANCELLED") trail(r.pickupDeadline, "System", "AUTO_CANCELLED", `${who} missed the 48h pickup window for “${what}”. Request auto-cancelled.`, { ...p, hours: 48 });
    trail(r.borrowedAt, staffName, "PICKUP_CONFIRMED", `${who} picked up “${what}”. Due in 14 days.`, { ...p, days: 14 });
    trail(r.returnedAt, staffName, "RETURN_CONFIRMED", `${who} returned “${what}”.`, p);
    if (r.status === "OVERDUE") trail(r.dueDate! + 12 * H, "System", "MARKED_OVERDUE", `${who}'s loan of “${what}” is now overdue.`, p);
  }
  s.activity = s.activity.filter((a) => a.at <= now).sort((a, b) => b.at - a.at);
  s.notifications.push({ id: 1, userId: daniel, at: now, read: false, code: "", params: {},
    message: "Your pickup window for “Thinking, Fast and Slow” closes soon." });
  return s;
}

// ------------------------------ storage ------------------------------

const state: DemoState = load();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as DemoState;
      return { ...saved, siteImages: saved.siteImages ?? {} };
    }
  } catch { /* unavailable or corrupt storage — reseed */ }
  return seed();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded or storage blocked — keep running in memory */ }
}

// ---------------------------- serializers ----------------------------

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
const userById = (id: number) => state.users.find((u) => u.id === id);
const bookById = (id: number) => state.books.find((b) => b.id === id);
const nextId = () => ++state.seq;

const hasOverdue = (userId: number) => state.records.some((r) => r.userId === userId && r.status === "OVERDUE");
/** Title of the member's longest-overdue loan, what they must return first (services.overdue_title). */
const overdueTitle = (userId: number): string | null => {
  const first = state.records
    .filter((r) => r.userId === userId && r.status === "OVERDUE")
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0) || a.id - b.id)[0];
  return first ? bookById(first.bookId)!.title : null;
};
const activeLoans = (userId: number) => state.records.filter((r) => r.userId === userId && ACTIVE.includes(r.status)).length;
const queueFor = (bookId: number) =>
  state.reservations.filter((r) => r.bookId === bookId && r.isActive).sort((a, b) => a.reservedAt - b.reservedAt);
/** Someone with an active account is waiting for the book (services.has_waiting_list). */
const hasWaitingList = (bookId: number) => queueFor(bookId).some((r) => userById(r.userId)?.active);
/** A personal override if there is one, else the default for the role from the settings (UserProfile.effective_borrow_limit). */
const effectiveLimit = (u: DUser) =>
  u.maxLimit ?? (u.role === "MEMBER" ? state.settings.memberBorrowLimit : state.settings.staffBorrowLimit);

type SettingField = "holdHours" | "loanDays" | "maxRenewals" | "memberBorrowLimit" | "staffBorrowLimit" | "reminderDaysBeforeDue";
/** Inclusive bounds, the same as LibrarySettingsSerializer. */
const SETTING_BOUNDS: Record<SettingField, [number, number]> = {
  holdHours: [1, 168], loanDays: [1, 90], maxRenewals: [0, 5], memberBorrowLimit: [1, 50],
  staffBorrowLimit: [1, 50], reminderDaysBeforeDue: [0, 14],
};
const SETTING_LABELS: Record<SettingField, string> = {
  holdHours: "hold hours", loanDays: "loan days", maxRenewals: "renewals per loan",
  memberBorrowLimit: "member borrow limit", staffBorrowLimit: "staff borrow limit",
  reminderDaysBeforeDue: "reminder days before due",
};

/** The admin view of the settings: every rule, when it last changed and who changed it. */
function sSettingsAdmin() {
  const s = state.settings;
  return {
    holdHours: s.holdHours, loanDays: s.loanDays, maxRenewals: s.maxRenewals, renewWindowDays: RENEW_WINDOW_DAYS,
    memberBorrowLimit: s.memberBorrowLimit, staffBorrowLimit: s.staffBorrowLimit,
    reminderDaysBeforeDue: s.reminderDaysBeforeDue, updatedAt: iso(s.updatedAt),
    updatedBy: s.updatedBy == null ? null : userById(s.updatedBy)?.name ?? null,
  };
}

/** The slot as GET /api/site-images returns it (library/site_image_views.py). */
function sSiteImage(image: DSiteImage | undefined) {
  if (!image) return null;
  const small = [image.src640, Math.min(640, image.width)] as const;
  const medium = [image.src1200, Math.min(1200, image.width)] as const;
  return {
    src: image.src1200,
    // Like the server, no two files at the same width: an original narrower than 1200 has one file only.
    srcset: (small[1] === medium[1] ? [small] : [small, medium]).map(([u, w]) => `${u} ${w}w`).join(", "),
    width: image.width, height: image.height,
    alt: { en: image.altEn, fr: image.altFr, ar: image.altAr },
    credit: image.credit, updatedAt: iso(image.updatedAt),
  };
}

function sCategory(c: DCategory) {
  return { id: c.id, name: c.name, color: c.color, bookCount: state.books.filter((b) => b.categoryId === c.id).length };
}

/** Copies on the shelf that are not already held for a READY pickup. */
const freeCopies = (b: DBook) =>
  Math.max(0, b.availableCopies - state.records.filter((r) => r.bookId === b.id && r.status === "READY").length);

/** `viewer` is the signed-in user: staff also get the one active loan of the book, for Return in the desk search. */
function sBook(b: DBook, viewer: DUser | null = null) {
  const { categoryId, ...rest } = b;
  const out = state.records.filter((r) => r.bookId === b.id && (r.status === "BORROWED" || r.status === "OVERDUE"));
  const single = viewer && viewer.role !== "MEMBER" && out.length === 1 ? out[0] : null;
  return {
    ...rest, freeCopies: freeCopies(b), category: sCategory(state.categories.find((c) => c.id === categoryId)!),
    activeLoanId: single ? single.id : null, activeLoanMember: single ? userById(single.userId)!.name : null,
  };
}

function sProfile(u: DUser) {
  return {
    id: u.id, uuid: u.uuid, name: u.name, email: u.email, studentOrStaffId: u.idNumber,
    phoneNumber: u.phone, address: u.address, role: u.role,
    membershipStartDate: new Date(u.since).toISOString().slice(0, 10),
    maxBorrowLimit: effectiveLimit(u), borrowLimitIsDefault: u.maxLimit === null, active: u.active, language: u.language, emailVerified: u.emailVerified,
    emailReminders: u.emailReminders !== false, activeLoans: activeLoans(u.id), hasOverdue: hasOverdue(u.id),
  };
}

function sRecord(r: DRecord) {
  const u = userById(r.userId)!;
  const b = bookById(r.bookId)!;
  return {
    id: r.id, userId: u.id, userProfileId: u.id, bookId: b.id, userName: u.name, userIdNumber: u.idNumber,
    bookTitle: b.title, bookShelf: b.shelfLocation, requestedAt: iso(r.requestedAt), approvedAt: iso(r.approvedAt),
    pickupDeadline: iso(r.pickupDeadline), borrowedAt: iso(r.borrowedAt), dueDate: iso(r.dueDate),
    returnedAt: iso(r.returnedAt), status: r.status, rejectionReason: r.rejectionReason ?? "",
    cancelledByMember: r.cancelledByMember ?? false,
    bookFreeCopies: freeCopies(b), memberHasOverdue: hasOverdue(u.id), memberOverdueTitle: overdueTitle(u.id), memberActiveLoans: activeLoans(u.id),
    memberMaxBorrowLimit: effectiveLimit(u), renewalCount: r.renewalCount ?? 0, bookHasQueue: hasWaitingList(b.id),
  };
}

function sReservation(r: DReservation) {
  const u = userById(r.userId)!;
  const pos = queueFor(r.bookId).findIndex((x) => x.id === r.id);
  return {
    id: r.id, userId: u.id, userProfileId: u.id, bookId: r.bookId, userName: u.name,
    bookTitle: bookById(r.bookId)!.title, reservedAt: iso(r.reservedAt), isActive: r.isActive,
    position: pos >= 0 ? pos + 1 : null,
  };
}

const recordsNewestFirst = (list: DRecord[]) => [...list].sort((a, b) => b.requestedAt - a.requestedAt);

// ------------------------------ services ------------------------------

/** An API error with the same body as Django's: `detail` plus a `code` (and `params`) the UI translates. */
class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, detail: string, code?: string, params?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    super(detail);
    this.status = status;
    this.body = { detail, ...(code ? { code } : {}), ...(params ? { params } : {}), ...extra };
  }
}

/** Handler result with a non-200 status (201 Created, 204 No Content). */
class Reply {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    this.status = status;
    this.data = data;
  }
}

const bad = (code: string, detail: string, params: Record<string, unknown> = {}) => new HttpError(400, detail, code, params);
const forbidden = (code: string, detail: string) => new HttpError(403, detail, code, {});
const notFound = () => new HttpError(404, "Not found.", "not_found");

/** A validation error shaped like DRF's: per-field messages and codes, also at the top level. */
function invalid(...errors: [field: string, message: string, code: string][]) {
  const fields: Record<string, string[]> = {};
  const fieldCodes: Record<string, string[]> = {};
  for (const [field, message, code] of errors) {
    (fields[field] ??= []).push(message);
    (fieldCodes[field] ??= []).push(code);
  }
  return new HttpError(400, "Invalid input.", "invalid", undefined, { ...fields, fields, fieldCodes });
}

/** `detail` is the English sentence; the UI translates `activity.<code>` with `params` (code = action in lower case). */
function log(actorName: string, action: string, detail: string, params: Record<string, unknown> = {}) {
  state.activity.unshift({ id: nextId(), at: Date.now(), actorName, action, detail, code: action.toLowerCase(), params });
}

function notify(userId: number, code: string, message: string, params: Record<string, unknown>) {
  state.notifications.unshift({ id: nextId(), userId, at: Date.now(), code, params, message, read: false });
}

function transition(op: string, r: DRecord, allowed: BorrowStatus[]) {
  if (!allowed.includes(r.status)) {
    throw new HttpError(409, `Invalid transition: cannot ${op} a record in status ${r.status}.`, "invalid_transition",
      { action: op, status: r.status });
  }
}

/** Give a free copy to the first active member of the reservation queue (stock is not touched). */
function handToQueue(book: DBook, now: number) {
  if (freeCopies(book) <= 0) return;
  const hours = state.settings.holdHours;
  for (const nxt of queueFor(book.id)) {
    nxt.isActive = false;
    const nu = userById(nxt.userId)!;
    if (!nu.active) continue;
    state.records.push({
      id: nextId(), userId: nxt.userId, bookId: book.id, requestedAt: nxt.reservedAt, approvedAt: now,
      pickupDeadline: now + hours * H, borrowedAt: null, dueDate: null, returnedAt: null, status: "READY",
    });
    log("System", "QUEUE_HANDOFF", `Reservation queue: “${book.title}” is now held for ${nu.name} (fresh ${hours}h window).`,
      { member: nu.name, title: book.title, hours });
    notify(nu.id, "queue_handoff", `Good news — “${book.title}” is now held for you. Pick it up within ${hours} hours.`,
      { title: book.title, hours });
    emailReady(state.records[state.records.length - 1]);
    return;
  }
}

/** Hourly + nightly jobs. Idempotent, so running them before every request is safe. */
function runJobs() {
  const now = Date.now();
  let cancelled = 0;
  let flaggedOverdue = 0;
  for (const r of state.records.filter((x) => x.status === "READY" && (x.pickupDeadline ?? Infinity) < now)) {
    const user = userById(r.userId)!;
    const book = bookById(r.bookId)!;
    r.status = "CANCELLED";
    cancelled++;
    // The window this hold actually had (the setting may have changed since it was approved).
    const hours = r.approvedAt != null ? Math.round((r.pickupDeadline! - r.approvedAt) / H) : state.settings.holdHours;
    log("System", "AUTO_CANCELLED", `${user.name} missed the ${hours}h pickup window for “${book.title}”. Request auto-cancelled.`,
      { member: user.name, title: book.title, hours });
    notify(user.id, "hold_expired", `Your request for “${book.title}” was auto-cancelled after the ${hours}h pickup window expired.`,
      { title: book.title, hours });
    handToQueue(book, now);
  }
  for (const r of state.records.filter((x) => x.status === "BORROWED" && (x.dueDate ?? Infinity) < now)) {
    const user = userById(r.userId)!;
    const book = bookById(r.bookId)!;
    r.status = "OVERDUE";
    flaggedOverdue++;
    log("System", "MARKED_OVERDUE", `${user.name}'s loan of “${book.title}” is now overdue.`,
      { member: user.name, title: book.title });
    notify(user.id, "overdue", `“${book.title}” is overdue. Please return it — new requests are blocked until resolved.`,
      { title: book.title });
    emailOverdue(r);
  }
  return { cancelled, flaggedOverdue, remindersSent: runDailyReminders(now) };
}

// ----------------------------- reminders -----------------------------
// Mirrors services.run_daily_reminders and the ready / overdue emails; the wording is in the email section below.

/** The member has an address and has not opted out of reminder emails (notifications always stay on). */
const wantsEmail = (u: DUser) => !!u.email && u.emailReminders !== false;

function emailReady(r: DRecord) {
  const u = userById(r.userId)!;
  const book = bookById(r.bookId)!;
  if (r.status !== "READY" || r.readyEmailSentAt || !wantsEmail(u)) return;
  const shelf = book.shelfLocation ? REMINDER_PARTS[u.language].shelf.replace("{shelf}", book.shelfLocation) : "";
  sendReminderMail("ready", u, book, { deadline: mailDate(r.pickupDeadline!, u.language), shelf_line: shelf });
  r.readyEmailSentAt = Date.now();
}

function emailOverdue(r: DRecord) {
  const u = userById(r.userId)!;
  if (r.status !== "OVERDUE" || r.overdueEmailSentAt || !wantsEmail(u)) return;
  sendReminderMail("overdue", u, bookById(r.bookId)!, { due: mailDate(r.dueDate!, u.language) });
  r.overdueEmailSentAt = Date.now();
}

/** Due-soon emails for loans inside the reminder window (0 turns them off), and overdue emails not yet sent. */
function runDailyReminders(now: number): number {
  let sent = 0;
  const days = state.settings.reminderDaysBeforeDue;
  if (days) {
    for (const r of state.records) {
      const u = userById(r.userId)!;
      if (r.status !== "BORROWED" || r.dueReminderSentAt || r.dueDate! < now || r.dueDate! > now + days * D || !wantsEmail(u)) continue;
      const hint = renewBlocker(r, now) ? "" : REMINDER_PARTS[u.language].renewal;
      sendReminderMail("due_soon", u, bookById(r.bookId)!, { due: mailDate(r.dueDate!, u.language), renewal: hint });
      r.dueReminderSentAt = now;
      sent++;
    }
  }
  for (const r of state.records) {
    if (r.status === "OVERDUE" && !r.overdueEmailSentAt && wantsEmail(userById(r.userId)!)) {
      emailOverdue(r);
      sent++;
    }
  }
  return sent;
}

/** Why a BORROWED loan cannot be renewed right now, or null (services.renewal_blocker, same checks in the same order). */
function renewBlocker(r: DRecord, now: number): { code: string; message: string; params: Record<string, unknown> } | null {
  const rules = state.settings;
  if (hasOverdue(r.userId)) {
    return { code: "overdue_block", message: "You have an overdue loan. Resolve it before renewing.", params: {} };
  }
  if ((r.renewalCount ?? 0) >= rules.maxRenewals) {
    return { code: "renew_limit", message: `This loan cannot be renewed again (limit ${rules.maxRenewals}).`, params: { max: rules.maxRenewals } };
  }
  if (hasWaitingList(r.bookId)) {
    return { code: "renew_queue", message: "Someone is waiting for this book, so it cannot be renewed.", params: {} };
  }
  if (r.dueDate! - now > RENEW_WINDOW_DAYS * D) {
    return {
      code: "renew_too_early", message: `A loan can be renewed in the last ${RENEW_WINDOW_DAYS} days before it is due.`,
      params: { days: RENEW_WINDOW_DAYS },
    };
  }
  return null;
}

// ------------------------------- PDFs -------------------------------

/** Minimal single-page text PDF (Helvetica, WinAnsi) — enough for receipts and ID cards. */
function textPdf(title: string, lines: string[]): Blob {
  const esc = (t: string) =>
    t.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'").replace(/[—–]/g, "-").replace(/·/g, "-")
      .replace(/[^\x20-\xFF]/g, "?").replace(/([\\()])/g, "\\$1");
  const body = [
    "BT /F2 20 Tf 56 780 Td (" + esc(title) + ") Tj ET",
    "0.055 0.42 0.235 RG 3 w 56 766 m 540 766 l S",
    ...lines.map((l, i) => `BT /F1 11 Tf 56 ${740 - i * 18} Td (${esc(l)}) Tj ET`),
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  // Every char is ≤ 0xFF, so one byte per char keeps the xref offsets exact.
  return new Blob([Uint8Array.from(out, (c) => c.charCodeAt(0))], { type: "application/pdf" });
}

const fmt = (ms: number | null) => (ms == null ? "-" : new Date(ms).toLocaleString());

// ------------------------------- router -------------------------------

interface Ctx {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, unknown>;
  form: FormData | null;
  user: DUser | null;
  headers: Headers;
}

type Handler = (ctx: Ctx, params: string[]) => unknown | Promise<unknown>;

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** Same envelope and limits as library/pagination.py; a page past the end is a 404. */
function paginate<T>(items: T[], ctx: Ctx, serialize: (item: T) => unknown) {
  const asked = ctx.query.get("pageSize") ?? "";
  const pageSize = /^\d+$/.test(asked) && Number(asked) > 0 ? Math.min(Number(asked), MAX_PAGE_SIZE) : PAGE_SIZE;
  const raw = ctx.query.get("page") ?? "1";
  const page = /^\d+$/.test(raw) ? Number(raw) : 0;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  if (page < 1 || page > pages) throw notFound();
  return {
    count: items.length, page, pageSize,
    results: items.slice((page - 1) * pageSize, page * pageSize).map(serialize),
  };
}

type SortKey = string | number | null;

/**
 * `ordering=` limited to `fields` (snake_case names, as in filters.py), `-` for descending.
 * `fallback` applies without the parameter. Ties break on id so pages never overlap.
 */
function orderBy<T extends { id: number }>(
  items: T[], ctx: Ctx, fields: Record<string, (item: T) => SortKey>, fallback: string,
): T[] {
  const asked = ctx.query.get("ordering");
  const keys = (asked ? asked.split(",") : [fallback]).map((k) => k.trim()).filter(Boolean);
  const order = keys.map((k) => {
    const field = k.replace(/^-/, "");
    if (!fields[field]) throw invalid(["ordering", "Invalid ordering.", "invalid_choice"]);
    return { get: fields[field], sign: k.startsWith("-") ? -1 : 1 };
  });
  // Nulls sort as the largest value, like PostgreSQL.
  const cmp = (a: SortKey, b: SortKey) =>
    a === b ? 0 : a === null ? 1 : b === null ? -1
      : typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : Number(a) - Number(b);
  return [...items].sort((x, y) => {
    for (const o of order) {
      const c = cmp(o.get(x), o.get(y));
      if (c) return c * o.sign;
    }
    return x.id - y.id;
  });
}

const csvNumbers = (raw: string | null) => (raw ?? "").split(",").map((v) => v.trim()).filter(Boolean).map(Number);

function requireUser(ctx: Ctx): DUser {
  if (!ctx.user) throw new HttpError(401, "Authentication credentials were not provided.", "not_authenticated");
  return ctx.user;
}

function requireStaff(ctx: Ctx): DUser {
  const u = requireUser(ctx);
  if (u.role === "MEMBER") throw new HttpError(403, "Forbidden: staff or admin role required.", "permission_denied");
  return u;
}

function requireAdmin(ctx: Ctx): DUser {
  const u = requireUser(ctx);
  if (u.role !== "ADMIN") throw new HttpError(403, "Forbidden: admin role required.", "permission_denied");
  return u;
}

function findRecord(id: string) {
  const r = state.records.find((x) => x.id === Number(id));
  if (!r) throw notFound();
  return r;
}

function findBook(id: unknown) {
  const b = bookById(Number(id));
  if (!b) throw notFound();
  return b;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function updateBook(ctx: Ctx, book: DBook, actor: DUser) {
  const src: Record<string, unknown> = ctx.form ? Object.fromEntries(ctx.form.entries()) : ctx.body;
  const onLoan = book.totalCopies - book.availableCopies;
  if (src.totalCopies !== undefined) {
    const total = Number(src.totalCopies);
    if (!Number.isInteger(total) || total < 1) throw invalid(["totalCopies", "Total copies must be at least 1.", "min_value"]);
    if (total < onLoan) throw bad("total_below_on_loan", `Cannot set total below ${onLoan} — that many copies are on loan.`, { onLoan });
    book.totalCopies = total;
    book.availableCopies = total - onLoan;
  }
  for (const key of ["title", "author", "isbn", "publisher", "shelfLocation", "coverColor", "description"] as const) {
    if (typeof src[key] === "string") book[key] = src[key] as string;
  }
  if (src.year !== undefined) book.year = src.year === "" || src.year === null ? null : Number(src.year);
  if (src.categoryId !== undefined) {
    if (!state.categories.some((c) => c.id === Number(src.categoryId))) throw invalid(["categoryId", "Invalid category.", "does_not_exist"]);
    book.categoryId = Number(src.categoryId);
  }
  if (src.coverImage instanceof File) book.coverImage = await fileToDataUrl(src.coverImage);
  else if (src.coverImage === null || src.coverImage === "") book.coverImage = null;
  log(actor.name, "BOOK_UPDATED", `Updated “${book.title}”.`, { title: book.title });
  return sBook(book);
}

function recordTransition(op: "approve" | "reject" | "pickup" | "return"): Handler {
  return (ctx, [id]) => {
    const staff = requireStaff(ctx);
    const r = findRecord(id);
    const user = userById(r.userId)!;
    const book = bookById(r.bookId)!;
    const now = Date.now();
    if (op === "approve") {
      transition("approve", r, ["PENDING"]);
      if (freeCopies(book) <= 0) {
        throw bad("approve_no_free_copy", "No free copy to hold — every copy is on loan or already held for pickup.");
      }
      const hours = state.settings.holdHours;
      Object.assign(r, { status: "READY", approvedAt: now, pickupDeadline: now + hours * H });
      log(staff.name, "APPROVED", `Approved ${user.name}'s request for “${book.title}”. Pickup within ${hours}h.`,
        { member: user.name, title: book.title, hours });
      notify(user.id, "request_approved", `Your request for “${book.title}” was approved. Pick it up within ${hours} hours.`,
        { title: book.title, hours });
      emailReady(r);
    } else if (op === "reject") {
      transition("reject", r, ["PENDING"]);
      const asked = ctx.body.reason;
      const reason = (typeof asked === "string" ? asked : "").trim().slice(0, REJECTION_REASON_MAX);
      r.status = "REJECTED";
      r.rejectionReason = reason;
      log(staff.name, "REJECTED", `Rejected ${user.name}'s request for “${book.title}”.`,
        { member: user.name, title: book.title });
      if (reason) {
        notify(user.id, "request_rejected", `Your request for “${book.title}” was rejected by staff. Reason: ${reason}`,
          { title: book.title, reason });
      } else {
        notify(user.id, "request_rejected", `Your request for “${book.title}” was rejected by staff.`, { title: book.title });
      }
    } else if (op === "pickup") {
      transition("pickup", r, ["READY"]);
      // The hold keeps its deadline: it can still expire and pass to the queue while the member is blocked.
      const blocking = overdueTitle(user.id);
      if (blocking) {
        throw bad("pickup_blocked_overdue",
          `The member has an overdue loan (“${blocking}”). It must be returned before this hold can be picked up.`,
          { title: blocking });
      }
      if (book.availableCopies <= 0) throw bad("pickup_no_copy", "No physical copy on the shelf to hand out.");
      const days = state.settings.loanDays;
      Object.assign(r, { status: "BORROWED", borrowedAt: now, dueDate: now + days * D });
      book.availableCopies -= 1;
      log(staff.name, "PICKUP_CONFIRMED", `${user.name} picked up “${book.title}”. Due in ${days} days.`,
        { member: user.name, title: book.title, days });
      notify(user.id, "picked_up", `You picked up “${book.title}”. Due back on ${new Date(r.dueDate!).toLocaleDateString()}.`,
        { title: book.title, dueDate: iso(r.dueDate) });
    } else {
      transition("return", r, ["BORROWED", "OVERDUE"]);
      Object.assign(r, { status: "RETURNED", returnedAt: now });
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      log(staff.name, "RETURN_CONFIRMED", `${user.name} returned “${book.title}”.`,
        { member: user.name, title: book.title });
      handToQueue(book, now);
    }
    return sRecord(r);
  };
}

// --------------------------- bulk import ---------------------------
// Port of backend/library/importing.py: same aliases, ISBN rules, error codes and statuses.

const IMPORT_FIELDS = ["isbn", "title", "author", "category", "publisher", "year", "totalCopies", "shelfLocation", "description"] as const;
type ImportField = typeof IMPORT_FIELDS[number];
const IMPORT_ALIASES: Record<ImportField, string[]> = {
  isbn: ["isbn", "isbn13", "isbn 13", "isbn10", "code isbn", "ردمك"],
  title: ["title", "book title", "titre", "titre du livre", "العنوان", "عنوان الكتاب"],
  author: ["author", "authors", "auteur", "auteurs", "writer", "المؤلف", "المؤلفون"],
  category: ["category", "categories", "categorie", "genre", "subject", "discipline", "التصنيف", "الفئة"],
  publisher: ["publisher", "editeur", "edition", "maison d edition", "الناشر", "دار النشر"],
  year: ["year", "publication year", "published", "annee", "annee de publication", "السنة", "سنة النشر"],
  totalCopies: ["total copies", "totalcopies", "copies", "copy count", "quantity", "qty", "exemplaires",
    "nombre d exemplaires", "nb exemplaires", "عدد النسخ", "النسخ"],
  shelfLocation: ["shelf location", "shelflocation", "shelf", "shelf mark", "location", "call number",
    "cote", "emplacement", "rayon", "الرف", "رمز الرف"],
  description: ["description", "summary", "resume", "abstract", "notes", "الوصف", "الملخص"],
};
const BINDINGS = ["#1F4D3A", "#6E2A2A", "#2B3F52", "#4A4E45", "#5C4630", "#29463F"];

function headerKey(header: string): string {
  // Drop accents (and Arabic vowel marks) but keep the letters, so Arabic headers stay distinct from each other.
  const text = header.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[_\-./’'()]/g, " ");
  return text.split(/\s+/).filter(Boolean).join(" ");
}
const HEADER_LOOKUP = new Map<string, ImportField>(
  (Object.entries(IMPORT_ALIASES) as [ImportField, string[]][]).flatMap(([f, as]) => as.map((a) => [headerKey(a), f] as const)),
);

function normalizeIsbn(raw: unknown): string | null {
  const text = String(raw).toUpperCase().replace(/[^0-9X]/g, "");
  if (/^\d{13}$/.test(text)) {
    const sum = [...text.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(text[12]) ? text : null;
  }
  if (/^\d{9}[\dX]$/.test(text)) {
    const sum = [...text.slice(0, 9)].reduce((s, d, i) => s + Number(d) * (10 - i), 0);
    const check = (11 - (sum % 11)) % 11;
    return text[9] === (check === 10 ? "X" : String(check)) ? text : null;
  }
  return null;
}

const cell = (v: unknown) => (v == null ? "" : String(v).trim());
function wholeNumber(v: unknown): number | null {
  const text = cell(v);
  if (!text) return null;
  const n = Number(text.replace(",", "."));
  return Number.isInteger(n) ? n : null;
}

function runImport(rows: Record<string, unknown>[], mode: string, dryRun: boolean, actor: string, source: string) {
  if (mode !== "skip" && mode !== "update") throw bad("import_bad_mode", "mode must be 'skip' or 'update'.");
  if (rows.length > 5000) throw bad("import_too_many_rows", "A single import is limited to 5000 rows; split the file.", { max: 5000 });
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)).filter((h) => !h.startsWith("__")))];
  const columns = Object.fromEntries(headers.map((h) => [h, HEADER_LOOKUP.get(headerKey(h)) ?? null]));
  const mapped = new Set(Object.values(columns));
  const missing = (["isbn", "title", "author"] as const).filter((f) => !mapped.has(f));
  const empty = { total: 0, create: 0, update: 0, unchanged: 0, skip: 0, error: 0, newCategories: 0 };
  if (rows.length && missing.length) return { dryRun, columns, missingColumns: missing, rows: [], summary: empty };

  const existing = new Map(state.books.map((b) => [normalizeIsbn(b.isbn) ?? b.isbn, b]));
  const categories = new Map(state.categories.map((c) => [c.name.toLowerCase(), c]));
  const thisYear = new Date().getFullYear();
  const seen = new Map<string, number>();
  const newCategories: string[] = [];
  type Plan = { values: Omit<DBook, "id" | "categoryId" | "availableCopies" | "coverColor" | "coverImage" | "isbn"> & { category: string }; book?: DBook; isbn: string };
  const plans: Plan[] = [];
  const results = [];

  for (const [index, raw] of rows.entries()) {
    const data = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null])) as Record<ImportField, unknown>;
    for (const [h, v] of Object.entries(raw)) {
      const f = columns[h];
      if (f && cell(data[f as ImportField]) === "") data[f as ImportField] = v;
    }
    if (!IMPORT_FIELDS.some((f) => cell(data[f]))) continue; // blank line
    const row = Number(raw.__row) || index + 1;
    const errors: Record<string, string | number>[] = [];
    const title = cell(data.title), author = cell(data.author);
    const isbn = cell(data.isbn) ? normalizeIsbn(data.isbn) : null;
    if (!cell(data.isbn)) errors.push({ code: "isbn_missing" });
    else if (!isbn) errors.push({ code: "isbn_invalid" });
    else if (seen.has(isbn)) errors.push({ code: "isbn_duplicate", row: seen.get(isbn)! });
    if (isbn && !seen.has(isbn)) seen.set(isbn, row);
    if (!title) errors.push({ code: "title_missing" });
    else if (title.length > 300) errors.push({ code: "title_too_long" });
    if (!author) errors.push({ code: "author_missing" });
    let year: number | null = null;
    if (cell(data.year)) {
      year = wholeNumber(data.year);
      if (year === null || year < 1000 || year > thisYear + 1) { errors.push({ code: "year_invalid" }); year = null; }
    }
    let copies = 1;
    if (cell(data.totalCopies)) {
      const n = wholeNumber(data.totalCopies);
      if (n === null || n < 1 || n > 1000) errors.push({ code: "copies_invalid", max: 1000 });
      else copies = n;
    }
    const book = isbn ? existing.get(isbn) : undefined;
    if (book && mode === "update") {
      const onLoan = book.totalCopies - book.availableCopies;
      if (copies < onLoan) errors.push({ code: "copies_below_loans", onLoan });
    }
    const res = { row, status: "error", isbn: isbn ?? cell(data.isbn), title, author, totalCopies: copies, errors, changes: [] as string[] };
    if (errors.length) { results.push(res); continue; }

    const category = cell(data.category) || "General";
    if (!categories.has(category.toLowerCase()) && !newCategories.includes(category)) newCategories.push(category);
    const values = {
      title, author, category, publisher: cell(data.publisher), year, totalCopies: copies,
      shelfLocation: cell(data.shelfLocation), description: cell(data.description),
    };
    if (!book) res.status = "create";
    else if (mode === "skip") res.status = "skip";
    else {
      const current: Record<string, unknown> = {
        title: book.title, author: book.author, category: state.categories.find((c) => c.id === book.categoryId)?.name ?? "",
        publisher: book.publisher, year: book.year, totalCopies: book.totalCopies,
        shelfLocation: book.shelfLocation, description: book.description,
      };
      const labels: Record<string, string> = { totalCopies: "copies", shelfLocation: "shelf" };
      res.changes = Object.entries(values)
        .filter(([k, v]) => (k === "category" ? String(current[k]).toLowerCase() !== String(v).toLowerCase() : current[k] !== v))
        .map(([k]) => labels[k] ?? k);
      res.status = res.changes.length ? "update" : "unchanged";
    }
    results.push(res);
    if (res.status === "create" || res.status === "update") plans.push({ values, book, isbn: isbn! });
  }

  if (!dryRun && plans.length) {
    for (const name of newCategories) {
      const c = { id: nextId(), name, color: "#4A5560" };
      state.categories.push(c);
      categories.set(name.toLowerCase(), c);
    }
    let created = 0, updated = 0;
    for (const { values, book, isbn } of plans) {
      const { category, ...fields } = values;
      const categoryId = categories.get(category.toLowerCase())!.id;
      if (!book) {
        const hash = [...isbn].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
        state.books.push({
          id: nextId(), isbn, categoryId, ...fields, availableCopies: fields.totalCopies,
          coverColor: BINDINGS[hash % BINDINGS.length], coverImage: null,
        });
        created++;
      } else {
        const onLoan = book.totalCopies - book.availableCopies;
        Object.assign(book, fields, { categoryId, availableCopies: Math.max(0, fields.totalCopies - onLoan) });
        updated++;
      }
    }
    log(actor, "BOOKS_IMPORTED", `Imported ${created} new books and updated ${updated}${source ? ` from ${source}` : ""}.`,
      { created, updated, source });
  }

  const summary = { ...empty, total: results.length, newCategories: newCategories.length };
  for (const r of results) summary[r.status as keyof typeof empty]++;
  return { dryRun, columns, missingColumns: [], newCategories, rows: results, summary };
}

// ------------------------- bulk student import -------------------------
// Port of backend/library/student_import.py: same aliases, error codes and statuses.

const STUDENT_FIELDS = ["name", "firstName", "lastName", "email", "studentId", "phone", "language"] as const;
type StudentField = typeof STUDENT_FIELDS[number];
const STUDENT_ALIASES: Record<StudentField, string[]> = {
  name: ["name", "full name", "fullname", "student name", "student", "nom", "nom complet", "nom et prenom",
    "nom prenom", "etudiant", "الاسم", "الاسم الكامل", "اسم الطالب"],
  firstName: ["first name", "firstname", "given name", "forename", "prenom", "الاسم الاول", "الاسم الأول"],
  lastName: ["last name", "lastname", "surname", "family name", "nom de famille", "اللقب", "اسم العائلة"],
  email: ["email", "e mail", "email address", "mail", "courriel", "adresse email", "adresse e mail",
    "adresse mail", "البريد", "البريد الالكتروني", "البريد الإلكتروني"],
  studentId: ["student id", "studentid", "id", "student number", "student no", "member id", "matricule",
    "numero etudiant", "numero d etudiant", "n etudiant", "code etudiant", "الرقم الجامعي",
    "رقم الطالب", "رقم التسجيل", "رقم الطالب الجامعي"],
  phone: ["phone", "phone number", "telephone", "tel", "mobile", "portable", "الهاتف", "رقم الهاتف"],
  language: ["language", "lang", "langue", "اللغة"],
};
const STUDENT_LOOKUP = new Map<string, StudentField>(
  (Object.entries(STUDENT_ALIASES) as [StudentField, string[]][]).flatMap(([f, as]) => as.map((a) => [headerKey(a), f] as const)),
);
const STUDENT_LANGUAGES: Record<string, Lang> = {
  en: "en", english: "en", anglais: "en", "الانجليزية": "en", "الإنجليزية": "en",
  fr: "fr", french: "fr", francais: "fr", "français": "fr", "الفرنسية": "fr",
  ar: "ar", arabic: "ar", arabe: "ar", "العربية": "ar",
};
/** A password nobody can type (Django's unusable password): the student chooses one from the welcome email. */
const UNUSABLE_PASSWORD = "\0unusable";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function runStudentImport(rows: Record<string, unknown>[], dryRun: boolean, actor: string, source: string) {
  if (rows.length > 5000) throw bad("import_too_many_rows", "A single import is limited to 5000 rows; split the file.", { max: 5000 });
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)).filter((h) => !h.startsWith("__")))];
  const columns = Object.fromEntries(headers.map((h) => [h, STUDENT_LOOKUP.get(headerKey(h)) ?? null]));
  const mapped = new Set(Object.values(columns));
  const missing = [
    ["name", mapped.has("name") || mapped.has("firstName") || mapped.has("lastName")],
    ["email", mapped.has("email")],
    ["studentId", mapped.has("studentId")],
  ].filter(([, ok]) => !ok).map(([f]) => f as string);
  const summarize = (list: { status: string }[]) => ({
    total: list.length, create: list.filter((r) => r.status === "create").length,
    exists: list.filter((r) => r.status === "exists").length, error: list.filter((r) => r.status === "error").length,
  });
  if (rows.length && missing.length) {
    return { dryRun, columns, missingColumns: missing, rows: [], summary: summarize([]), emailsSent: 0 };
  }

  const existingEmails = new Set(state.users.map((u) => u.email.toLowerCase()));
  const takenIds = new Set(state.users.map((u) => u.idNumber));
  const seenEmails = new Map<string, number>();
  const seenIds = new Map<string, number>();
  type Plan = { first: string; last: string; email: string; studentId: string; phone: string; language: Lang };
  const results: { row: number; status: string; name: string; email: string; studentId: string; language: string; errors: Record<string, string | number>[] }[] = [];
  const plans: { res: typeof results[number]; plan: Plan }[] = [];

  for (const [index, raw] of rows.entries()) {
    const data = Object.fromEntries(STUDENT_FIELDS.map((f) => [f, null])) as Record<StudentField, unknown>;
    for (const [h, v] of Object.entries(raw)) {
      const f = columns[h];
      if (f && cell(data[f as StudentField]) === "") data[f as StudentField] = v;
    }
    if (!STUDENT_FIELDS.some((f) => cell(data[f]))) continue; // blank line
    const row = Number(raw.__row) || index + 1;
    let first = cell(data.firstName), last = cell(data.lastName);
    if (first && !last) last = cell(data.name); // "Nom" next to "Prénom" is the family name, not the full name
    else if (!first && !last) {
      const full = cell(data.name);
      const space = full.indexOf(" ");
      first = space < 0 ? full : full.slice(0, space);
      last = space < 0 ? "" : full.slice(space + 1).trim();
    }
    const email = cell(data.email).toLowerCase();
    const studentId = cell(data.studentId);
    const phone = cell(data.phone);
    const langText = cell(data.language);
    const errors: Record<string, string | number>[] = [];
    const res = { row, status: "error", name: `${first} ${last}`.trim(), email, studentId, language: "", errors };

    if (!first && !last) errors.push({ code: "name_missing" });
    else if (first.length > 150 || last.length > 150) errors.push({ code: "name_too_long" });

    let emailOk = false;
    if (!email) errors.push({ code: "email_missing" });
    else {
      emailOk = EMAIL_SHAPE.test(email) && email.length <= 150; // the email is the username
      if (!emailOk) errors.push({ code: "email_invalid" });
    }
    if (emailOk) {
      if (seenEmails.has(email)) errors.push({ code: "email_duplicate", row: seenEmails.get(email)! });
      if (!seenEmails.has(email)) seenEmails.set(email, row);
    }

    if (!studentId) errors.push({ code: "student_id_missing" });
    else if (studentId.length > 30) errors.push({ code: "student_id_too_long" });
    else {
      const key = studentId.toLowerCase();
      if (seenIds.has(key)) errors.push({ code: "student_id_duplicate", row: seenIds.get(key)! });
      if (!seenIds.has(key)) seenIds.set(key, row);
    }
    if (phone.length > 40) errors.push({ code: "phone_invalid" });

    let language: Lang | undefined = "en";
    if (langText) {
      language = STUDENT_LANGUAGES[langText.toLowerCase()];
      if (!language) errors.push({ code: "language_invalid" });
    }
    res.language = language ?? langText;

    if (!errors.length && existingEmails.has(email)) res.status = "exists"; // already has an account: left alone
    else if (!errors.length && takenIds.has(studentId)) errors.push({ code: "student_id_taken" });
    if (!errors.length && res.status !== "exists") {
      res.status = "create";
      plans.push({ res, plan: { first, last, email, studentId, phone, language: language! } });
    }
    results.push(res);
  }

  let emailsSent = 0;
  if (!dryRun && plans.length) {
    const created: DUser[] = [];
    for (const { plan } of plans) {
      const user: DUser = {
        id: nextId(), uuid: uuid(), name: `${plan.first} ${plan.last}`.trim(), email: plan.email,
        password: UNUSABLE_PASSWORD, idNumber: plan.studentId, phone: plan.phone, address: "", role: "MEMBER",
        since: Date.now(), active: true, maxLimit: null, language: plan.language, emailVerified: false,
      };
      state.users.push(user);
      created.push(user);
    }
    const existing = results.filter((r) => r.status === "exists").length;
    log(actor, "STUDENTS_IMPORTED",
      `Imported ${created.length} students${source ? ` from ${source}` : ""} (${existing} already had an account).`,
      { created: created.length, existing, source });
    // After the "commit": the welcome email carries the password-reset link.
    for (const user of created) {
      sendMail("welcome", user.language, user.email, user.name.split(" ")[0],
        `/reset-password?uid=${user.id}&token=${issueToken("reset", user)}`, VALIDITY.hour[user.language]);
      emailsSent++;
    }
  }
  return { dryRun, columns, missingColumns: [], rows: results, summary: summarize(results), emailsSent };
}

// ------------------------------ exports ------------------------------
// Port of backend/library/exports.py. The demo build has no XLSX writer, so only CSV is offered.

const BOOK_COLUMNS = ["isbn", "title", "author", "category", "publisher", "year", "total_copies", "shelf_location",
  "description", "available_copies", "free_copies"];
const LOAN_COLUMNS = ["member", "student_id", "email", "title", "isbn", "shelf_location", "status", "requested_at",
  "borrowed_at", "due_date", "returned_at", "renewals"];

/** A text cell that starts like a formula gets a leading apostrophe, so Excel and Sheets show it as text. */
function safeCell(value: unknown): unknown {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** CSV with a BOM (Excel then opens Arabic correctly), CRLF line ends and minimal quoting, like Python's csv module. */
function csvDownload(columns: string[], rows: unknown[][]): Blob {
  const line = (cells: unknown[]) => cells.map((v) => {
    const text = v == null ? "" : String(safeCell(v));
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",") + "\r\n";
  return new Blob(["\uFEFF" + line(columns) + rows.map(line).join("")], { type: "text/csv;charset=utf-8" });
}

function exportFormat(ctx: Ctx) {
  const fmt = (ctx.query.get("format") || "csv").toLowerCase();
  if (fmt !== "csv") throw bad("export_bad_format", "format must be 'csv' (the demo has no Excel export).");
}

function exportDay(ctx: Ctx, name: "from" | "to"): number | null {
  const raw = ctx.query.get(name);
  if (!raw) return null;
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? Date.parse(`${raw}T00:00:00Z`) : NaN;
  if (Number.isNaN(ms)) throw bad("export_bad_date", `'${name}' must be a date like 2026-10-03.`, { field: name });
  return ms;
}

/** `YYYY-MM-DD HH:MM` in the library's time zone (UTC in the demo), or blank. */
const stamp = (ms: number | null) => (ms == null ? "" : new Date(ms).toISOString().slice(0, 16).replace("T", " "));

// The demo has no real cookies: the refresh token sits in localStorage under DEMO_REFRESH_KEY,
// which plays the part of the httpOnly cookie jar.
const readRefreshToken = () => {
  try { return localStorage.getItem(DEMO_REFRESH_KEY); } catch { return null; }
};
const dropRefreshToken = () => {
  try { localStorage.removeItem(DEMO_REFRESH_KEY); } catch { /* storage blocked */ }
};
function setRefreshToken(userId: number) {
  try {
    localStorage.setItem(DEMO_REFRESH_KEY, `demo-refresh.${userId}.${Date.now()}.${Math.random().toString(36).slice(2)}`);
  } catch { /* storage blocked: the session will not survive a reload */ }
}
function refreshTokenUser(token: string): DUser | undefined {
  if (state.revokedTokens.includes(token)) return undefined;
  const m = /^demo-refresh\.(\d+)\.(\d+)\./.exec(token);
  const user = m ? userById(Number(m[1])) : undefined;
  return user && Number(m![2]) >= (user.sessionsRevokedAt ?? 0) ? user : undefined;
}
function requireCsrfHeader(ctx: Ctx) {
  if (!ctx.headers.get(CSRF_HEADER)) throw forbidden("csrf_missing", "Missing CSRF header.");
}

// ------------------------------ email ------------------------------
// The demo cannot send mail, so messages land in state.outbox and are listed at /demo/mailbox.
// The wording mirrors backend/library/emails.py.

type MailKind = "reset" | "verify" | "invite" | "welcome" | "ready" | "due_soon" | "overdue";
const MAIL: Record<MailKind, Record<Lang, [string, string]>> = {
  reset: {
    en: ["Reset your {library} password",
      "We received a request to reset the password of your {library} account. Open this link to choose a new one:\n\n{link}\n\nThe link is valid for {validity} and works once. If you did not ask for this, ignore this email: your password stays as it is."],
    fr: ["Réinitialisez votre mot de passe de la {library}",
      "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte auprès de la {library}. Ouvrez ce lien pour en choisir un nouveau :\n\n{link}\n\nLe lien est valable {validity} et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé."],
    ar: ["إعادة تعيين كلمة مرور {library}",
      "تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في {library}. افتح هذا الرابط لاختيار كلمة مرور جديدة:\n\n{link}\n\nالرابط صالح لمدة {validity} ويعمل مرة واحدة فقط. إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي."],
  },
  verify: {
    en: ["Confirm your {library} email address",
      "Welcome to {library}. Confirm that this address is yours to start borrowing books:\n\n{link}\n\nThe link is valid for {validity}. You can ask for a new one from the notice at the top of the site."],
    fr: ["Confirmez votre adresse e-mail pour la {library}",
      "Bienvenue à la {library}. Confirmez que cette adresse est bien la vôtre pour pouvoir emprunter des livres :\n\n{link}\n\nLe lien est valable {validity}. Vous pouvez en demander un nouveau depuis l'avis en haut du site."],
    ar: ["تأكيد عنوان بريدك الإلكتروني في {library}",
      "مرحبًا بك في {library}. أكّد أن هذا العنوان لك لتتمكن من استعارة الكتب:\n\n{link}\n\nالرابط صالح لمدة {validity}. يمكنك طلب رابط جديد من الإشعار في أعلى الموقع."],
  },
  invite: {
    en: ["You are invited to join {library} as {role}",
      "You have been invited to create a {role} account at {library}. Open this link to sign up with this email address:\n\n{link}\n\nThe link is valid for {validity} and can be used once."],
    fr: ["Invitation à rejoindre la {library} comme {role}",
      "Vous êtes invité(e) à créer un compte {role} à la {library}. Ouvrez ce lien pour vous inscrire avec cette adresse e-mail :\n\n{link}\n\nLe lien est valable {validity} et ne peut être utilisé qu'une fois."],
    ar: ["دعوة للانضمام إلى {library} بصفة {role}",
      "تمت دعوتك لإنشاء حساب {role} في {library}. افتح هذا الرابط للتسجيل بهذا البريد الإلكتروني:\n\n{link}\n\nالرابط صالح لمدة {validity} ويمكن استخدامه مرة واحدة فقط."],
  },
  welcome: {
    en: ["Your {library} account is ready: set your password",
      "An account has been created for you at {library}. Set your password to start borrowing books:\n\n{link}\n\nThe link is valid for {validity} and works once. If it has expired, open the sign-in page and choose “Forgot password?” to get a new one."],
    fr: ["Votre compte pour la {library} est prêt : choisissez votre mot de passe",
      "Un compte a été créé pour vous à la {library}. Choisissez votre mot de passe pour commencer à emprunter des livres :\n\n{link}\n\nLe lien est valable {validity} et ne fonctionne qu'une fois. S'il a expiré, ouvrez la page de connexion et choisissez « Mot de passe oublié ? » pour en recevoir un nouveau."],
    ar: ["حسابك في {library} جاهز: اختر كلمة مرورك",
      "تم إنشاء حساب لك في {library}. اختر كلمة مرورك لتبدأ باستعارة الكتب:\n\n{link}\n\nالرابط صالح لمدة {validity} ويعمل مرة واحدة فقط. إذا انتهت صلاحيته، افتح صفحة تسجيل الدخول واختر «نسيت كلمة المرور؟» للحصول على رابط جديد."],
  },
  ready: {
    en: ["“{title}” is ready for pickup",
      "“{title}” is being held for you at {library}.\n\n{shelf_line}Pick it up by {deadline}. If you do not, the hold is cancelled and the book goes to the next person on the waiting list.\n\nYour loans: {link}\n\n{footer}"],
    fr: ["« {title} » est prêt à être retiré",
      "« {title} » est réservé pour vous à la {library}.\n\n{shelf_line}Venez le retirer avant le {deadline}. Passé ce délai, la réservation est annulée et le livre passe au prochain membre de la liste d'attente.\n\nVos prêts : {link}\n\n{footer}"],
    ar: ["«{title}» جاهز للاستلام",
      "«{title}» محجوز لك في {library}.\n\n{shelf_line}يرجى استلامه قبل {deadline}. بعد ذلك يُلغى الحجز وينتقل الكتاب إلى العضو التالي في قائمة الانتظار.\n\nإعاراتي: {link}\n\n{footer}"],
  },
  due_soon: {
    en: ["“{title}” is due back soon",
      "Your loan of “{title}” is due back on {due}. Please return it to the circulation desk by then.{renewal}\n\nYour loans: {link}\n\n{footer}"],
    fr: ["« {title} » est bientôt à rendre",
      "Votre prêt de « {title} » est à rendre le {due}. Merci de le rapporter au bureau de prêt avant cette date.{renewal}\n\nVos prêts : {link}\n\n{footer}"],
    ar: ["موعد إرجاع «{title}» يقترب",
      "موعد إرجاع «{title}» المُعار لك هو {due}. يرجى إعادته إلى مكتب الإعارة قبل ذلك.{renewal}\n\nإعاراتي: {link}\n\n{footer}"],
  },
  overdue: {
    en: ["“{title}” is overdue",
      "“{title}” was due back on {due} and has not been returned. New requests are blocked until you return it at the circulation desk.\n\nYour loans: {link}\n\n{footer}"],
    fr: ["« {title} » est en retard",
      "« {title} » devait être rendu le {due} et ne l'a pas été. Les nouvelles demandes sont bloquées tant que vous ne l'avez pas rapporté au bureau de prêt.\n\nVos prêts : {link}\n\n{footer}"],
    ar: ["«{title}» متأخر عن موعد الإرجاع",
      "كان موعد إرجاع «{title}» في {due} ولم يُرجَع بعد. الطلبات الجديدة محظورة إلى أن تعيده إلى مكتب الإعارة.\n\nإعاراتي: {link}\n\n{footer}"],
  },
};
/** Pieces of the reminder emails (emails.REMINDER_PARTS). */
const REMINDER_PARTS: Record<Lang, { shelf: string; renewal: string; footer: string }> = {
  en: { shelf: "Shelf mark: {shelf}\n", renewal: " You can renew it from My loans.",
    footer: "You get this email because email reminders are on. You can turn them off in your profile: {profile_link}" },
  fr: { shelf: "Cote : {shelf}\n", renewal: " Vous pouvez le renouveler depuis Mes prêts.",
    footer: "Vous recevez cet e-mail parce que les rappels par e-mail sont activés. Vous pouvez les désactiver dans votre profil : {profile_link}" },
  ar: { shelf: "رمز الرف: {shelf}\n", renewal: " يمكنك تجديده من إعاراتي.",
    footer: "تصلك هذه الرسالة لأن التذكيرات بالبريد الإلكتروني مفعّلة. يمكنك إيقافها من ملفك الشخصي: {profile_link}" },
};
/** The time zone dates are written in inside emails (LIBRARY_TIME_ZONE; the demo has no setting for it). */
const LIBRARY_TIME_ZONE = "UTC";
const MAIL_LOCALES: Record<Lang, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-u-ca-gregory-nu-latn" };

/** "5 October 2026, 14:30" with the month spelled in the member's language (emails.local_datetime). */
function mailDate(ms: number, lang: Lang): string {
  const when = new Date(ms);
  const day = new Intl.DateTimeFormat(MAIL_LOCALES[lang], { day: "numeric", month: "long", year: "numeric", timeZone: LIBRARY_TIME_ZONE }).format(when);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: LIBRARY_TIME_ZONE }).format(when);
  return `${day}, ${time}`;
}
const GREETING: Record<Lang, [string, string]> = {
  en: ["Hello {name},", "Hello,"], fr: ["Bonjour {name},", "Bonjour,"], ar: ["مرحبًا {name}،", "مرحبًا،"],
};
const VALIDITY: Record<"hour" | "week", Record<Lang, string>> = {
  hour: { en: "1 hour", fr: "1 heure", ar: "ساعة واحدة" },
  week: { en: "7 days", fr: "7 jours", ar: "7 أيام" },
};
const ROLE_NAMES: Record<"STAFF" | "ADMIN", Record<Lang, string>> = {
  STAFF: { en: "staff", fr: "membre du personnel", ar: "موظف" },
  ADMIN: { en: "admin", fr: "administrateur", ar: "مسؤول" },
};
const LINK_LIFETIME = H;
const INVITE_LIFETIME = 7 * D;
const badLink = () => bad("link_invalid", "This link is invalid or has expired.");
const UNVERIFIED = "Confirm your email address first: check your inbox for the verification link.";
const LANGS: Lang[] = ["en", "fr", "ar"];

function sendMail(
  kind: MailKind, lang: Lang, to: string, name: string | null, path: string,
  validity: string, role = "", extra: Record<string, string> = {},
) {
  const link = `${window.location.origin}${path}`;
  const vars: Record<string, string> = { library: LIBRARY_NAMES[lang], role, link, validity, ...extra };
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  const [subject, body] = MAIL[kind][lang];
  const greeting = name ? GREETING[lang][0].replace("{name}", name) : GREETING[lang][1];
  state.outbox.unshift({ id: nextId(), to, subject: fill(subject), body: `${greeting}\n\n${fill(body)}\n\n${LIBRARY_NAMES[lang]}`, link, at: Date.now() });
}

/** A loan reminder to the member, in their language, linking to My loans. */
function sendReminderMail(kind: "ready" | "due_soon" | "overdue", user: DUser, book: DBook, values: Record<string, string>) {
  const footer = REMINDER_PARTS[user.language].footer.replace("{profile_link}", `${window.location.origin}/profile`);
  sendMail(kind, user.language, user.email, user.name.split(" ")[0], "/my-requests", "", "", { title: book.title, footer, ...values });
}

function issueToken(kind: "reset" | "verify", user: DUser): string {
  const token = uuid().replace(/-/g, "");
  state.emailTokens.push({ token, kind, userId: user.id, expiresAt: Date.now() + LINK_LIFETIME, used: false });
  return token;
}

/** The user a still-valid, unused link belongs to. */
function userForToken(kind: "reset" | "verify", uid: unknown, token: unknown): DUser | undefined {
  const user = userById(Number(uid));
  const found = state.emailTokens.find((t) => t.kind === kind && t.token === token && t.userId === user?.id);
  return user && found && !found.used && found.expiresAt > Date.now() ? user : undefined;
}

/** A used link, and every older one of its kind, stops working (the real tokens hash the changed state). */
function spendTokens(kind: "reset" | "verify", user: DUser) {
  state.emailTokens.forEach((t) => { if (t.kind === kind && t.userId === user.id) t.used = true; });
}

/** Queue a reset or verification email whose link carries the user and a fresh token. */
function sendLinkMail(kind: "reset" | "verify", user: DUser) {
  const base = kind === "reset" ? "/reset-password" : "/verify-email";
  sendMail(kind, user.language, user.email, user.name.split(" ")[0],
    `${base}?uid=${user.id}&token=${issueToken(kind, user)}`, VALIDITY.hour[user.language]);
}

const pendingInvites = () =>
  state.invites.filter((i) => i.usedAt == null && i.revokedAt == null && i.expiresAt > Date.now());

function sInvite(i: DInvite) {
  return {
    id: i.id, email: i.email, role: i.role, createdAt: iso(i.createdAt), expiresAt: iso(i.expiresAt),
    createdBy: userById(i.createdBy)?.name ?? null,
  };
}

/** Mirrors Django's password validators (length, all-numeric, common, similar to the email). */
/** The first password rule the password breaks, with Django's validator codes (empty when it passes). */
function passwordErrors(pw: string, email: string): [message: string, code: string][] {
  if (pw.length < 8) return [["This password is too short. It must contain at least 8 characters.", "password_too_short"]];
  if (/^\d+$/.test(pw)) return [["This password is entirely numeric.", "password_entirely_numeric"]];
  if (["password", "password1", "12345678", "qwertyuiop", "iloveyou", "azertyuiop"].includes(pw.toLowerCase())) {
    return [["This password is too common.", "password_too_common"]];
  }
  if (email && pw.toLowerCase().includes(email.split("@")[0])) {
    return [["The password is too similar to the email address.", "password_too_similar"]];
  }
  return [];
}

/** The catalog filters (filters.BookFilter): the list and the export share them. */
function filterBooks(ctx: Ctx): DBook[] {
  const search = ctx.query.get("search")?.toLowerCase();
  const category = ctx.query.get("category");
  const author = ctx.query.get("author")?.toLowerCase();
  const isbn = ctx.query.get("isbn")?.toLowerCase();
  const available = ["1", "true", "yes"].includes((ctx.query.get("available") ?? "").toLowerCase());
  const ids = ctx.query.has("ids") ? csvNumbers(ctx.query.get("ids")) : null;
  return state.books
    .filter((b) => !search || [b.title, b.author, b.isbn, b.shelfLocation].some((f) => f.toLowerCase().includes(search)))
    .filter((b) => !category || state.categories.find((c) => c.id === b.categoryId)?.name === category)
    .filter((b) => !author || b.author.toLowerCase().includes(author))
    .filter((b) => !isbn || b.isbn.toLowerCase().includes(isbn))
    .filter((b) => !available || freeCopies(b) > 0)
    .filter((b) => !ids || ids.includes(b.id));
}

// ---------------------------- site photographs ----------------------------
// The server re-encodes with Pillow (library/site_images.py); the demo has no server, so the browser does it with a
// canvas. Drawing to a canvas drops EXIF and every other kind of metadata, as the server does, and the pixels are
// converted to greyscale.

const SITE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const SITE_IMAGE_MAX_PIXELS = 40_000_000;
const SITE_IMAGE_TEXT_MAX = 200;
const SITE_IMAGE_MIN_WIDTH: Record<SiteSlot, number> = { hero: 1200, feature: 1200, auth: 640 };

/** JPEG, PNG or WebP by the file's first bytes, not by its name or the type the browser reported. */
async function sniffImage(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpeg || png || webp;
}

const siteText = (value: unknown, field: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > SITE_IMAGE_TEXT_MAX) {
    throw bad("site_image_text_too_long", `Keep the ${field} to ${SITE_IMAGE_TEXT_MAX} characters or fewer.`, { field, max: SITE_IMAGE_TEXT_MAX });
  }
  return text;
};

async function encodeSiteImage(file: unknown, slot: SiteSlot) {
  if (!(file instanceof File)) throw bad("image_required", "Choose a photograph to upload.");
  if (file.size > SITE_IMAGE_MAX_BYTES) {
    throw bad("image_too_large", "The photograph is larger than 8 MB.", { maxMb: SITE_IMAGE_MAX_BYTES / 2 ** 20 });
  }
  const unreadable = () => bad("image_invalid", "The file is not a readable image.");
  let bitmap: ImageBitmap;
  try {
    if (!(await sniffImage(file))) {
      // Something else a browser can show (GIF, BMP) is a type error; anything it cannot decode is just not an image.
      await createImageBitmap(file).then((other) => other.close());
      throw bad("image_type_not_allowed", "Only JPEG, PNG and WebP photographs are accepted.");
    }
    bitmap = await createImageBitmap(file); // applies the EXIF rotation
  } catch (e) {
    throw e instanceof HttpError ? e : unreadable();
  }
  try {
    if (bitmap.width * bitmap.height > SITE_IMAGE_MAX_PIXELS) {
      throw bad("image_too_many_pixels", "The photograph has more than 40 megapixels.", { megapixels: SITE_IMAGE_MAX_PIXELS / 1_000_000 });
    }
    const minimum = SITE_IMAGE_MIN_WIDTH[slot];
    if (bitmap.width < minimum) {
      throw bad("image_too_small", `The photograph must be at least ${minimum} pixels wide.`, { minWidth: minimum, width: bitmap.width });
    }
    const render = (target: number) => {
      const w = Math.min(target, bitmap.width); // never upscaled
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = Math.max(1, Math.round((bitmap.height * w) / bitmap.width));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw unreadable();
      ctx.fillStyle = "#fff"; // transparency is flattened onto white
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Black and white for every slot, as on the server (ImageOps.grayscale: the same Rec. 601 weights).
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < px.data.length; i += 4) {
        const grey = Math.round(0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2]);
        px.data[i] = px.data[i + 1] = px.data[i + 2] = grey;
      }
      ctx.putImageData(px, 0, 0);
      return canvas.toDataURL("image/webp", 0.82);
    };
    return { src1200: render(1200), src640: render(640), width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function siteSlot(raw: string): SiteSlot {
  if (!SITE_SLOTS.includes(raw as SiteSlot)) throw notFound();
  return raw as SiteSlot;
}

const SITE_SLOT_NAMES: Record<SiteSlot, string> = { hero: "landing page", feature: "landing page feature", auth: "sign-in pages" };

const ROUTES: [string, RegExp, Handler][] = [
  // ------------------------------ auth ------------------------------
  ["POST", /^\/auth\/login$/, (ctx) => {
    const email = String(ctx.body.username ?? "").trim().toLowerCase();
    const u = state.users.find((x) => x.email === email);
    if (!u || u.password === UNUSABLE_PASSWORD || u.password !== ctx.body.password || !u.active) {
      throw new HttpError(401, "No active account found with the given credentials", "no_active_account");
    }
    setRefreshToken(u.id);
    return { access: `demo.${u.id}` };
  }],
  ["POST", /^\/auth\/refresh$/, (ctx) => {
    requireCsrfHeader(ctx);
    const token = readRefreshToken();
    if (!token) throw new HttpError(401, "No active session.", "no_session", {});
    const user = refreshTokenUser(token);
    if (!user || !user.active) {
      dropRefreshToken();
      throw new HttpError(401, "Session expired.", "session_expired", {});
    }
    state.revokedTokens.push(token);
    setRefreshToken(user.id);
    return { access: `demo.${user.id}` };
  }],
  ["POST", /^\/auth\/logout$/, (ctx) => {
    requireCsrfHeader(ctx);
    const token = readRefreshToken();
    if (token) state.revokedTokens.push(token);
    dropRefreshToken();
    return new Reply(204, null);
  }],
  ["POST", /^\/auth\/register$/, (ctx) => {
    const d = ctx.body as Record<string, string | undefined>;
    const email = (d.email ?? "").trim().toLowerCase();
    const errors: [string, string, string][] = [];
    if (!d.name?.trim()) errors.push(["name", "Name is required.", "blank"]);
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(["email", "Enter a valid email address.", "invalid"]);
    else if (state.users.some((u) => u.email === email)) {
      errors.push(["email", "An account with this email already exists.", "unique"]);
    }
    for (const [message, code] of passwordErrors(d.password ?? "", email)) errors.push(["password", message, code]);
    if (!d.studentId?.trim()) errors.push(["studentId", "Student ID is required.", "blank"]);
    else if (state.users.some((u) => u.idNumber.toLowerCase() === d.studentId!.toLowerCase())) {
      errors.push(["studentId", "This ID is already registered.", "unique"]);
    }
    if (errors.length) throw invalid(...errors);
    let role: Role = "MEMBER";
    // An invite fixes the role and the address; a missing, used, revoked, expired or foreign one creates nothing.
    const token = ctx.body.inviteToken;
    const invite = token ? pendingInvites().find((i) => i.token === token) : undefined;
    if (token) {
      if (!invite || invite.email !== email) {
        throw bad("invite_invalid", "This invitation is invalid, expired or for another email address.");
      }
      role = invite.role;
    }
    const u: DUser = {
      id: nextId(), uuid: uuid(), name: d.name!.trim(), email, password: d.password!, idNumber: d.studentId!.trim(),
      phone: d.phoneNumber ?? "", address: d.address ?? "", role, since: Date.now(),
      maxLimit: null, active: true,
      language: LANGS.find((l) => l === ctx.body.language) ?? "en",
      emailVerified: !!invite, // following the invite link proved the address
    };
    state.users.push(u);
    if (invite) invite.usedAt = Date.now();
    else sendLinkMail("verify", u);
    log("System", "REGISTERED", `${u.name} registered as ${role.toLowerCase()}.`, { member: u.name, role });
    return new Reply(201, sProfile(u));
  }],
  ["GET", /^\/users\/me$/, (ctx) => sProfile(requireUser(ctx))],
  ["PATCH", /^\/users\/me$/, (ctx) => {
    const u = requireUser(ctx);
    if (typeof ctx.body.phoneNumber === "string") u.phone = ctx.body.phoneNumber;
    if (typeof ctx.body.address === "string") u.address = ctx.body.address;
    const language = LANGS.find((l) => l === ctx.body.language);
    if (language) u.language = language;
    if (typeof ctx.body.emailReminders === "boolean") u.emailReminders = ctx.body.emailReminders;
    return sProfile(u);
  }],
  ["POST", /^\/auth\/password-reset$/, (ctx) => {
    const email = String(ctx.body.email ?? "").trim().toLowerCase();
    const user = state.users.find((u) => u.email === email && u.active);
    if (user) sendLinkMail("reset", user);
    return new Reply(202, null); // the same answer whether or not the account exists
  }],
  ["POST", /^\/auth\/password-reset\/confirm$/, (ctx) => {
    const user = userForToken("reset", ctx.body.uid, ctx.body.token);
    if (!user || !user.active) throw badLink();
    const errors = passwordErrors(String(ctx.body.password ?? ""), user.email);
    if (errors.length) throw invalid(...errors.map(([message, code]): [string, string, string] => ["password", message, code]));
    user.password = String(ctx.body.password);
    user.emailVerified = true; // the link went to the address on file, so using it proves the address
    spendTokens("reset", user);
    user.sessionsRevokedAt = Date.now() + 1; // every session ends; the next sign-in starts a new one
    log(user.name, "PASSWORD_RESET", `${user.name} reset their password.`, { member: user.name });
    return new Reply(204, null);
  }],
  ["POST", /^\/auth\/verify-email$/, (ctx) => {
    const user = userForToken("verify", ctx.body.uid, ctx.body.token);
    if (!user) throw badLink();
    user.emailVerified = true;
    spendTokens("verify", user);
    return new Reply(204, null);
  }],
  ["POST", /^\/auth\/verify-email\/resend$/, (ctx) => {
    const u = requireUser(ctx);
    if (u.emailVerified) throw bad("already_verified", "Your email address is already verified.");
    sendLinkMail("verify", u);
    return new Reply(202, null);
  }],
  // ------------------------------ staff invites ------------------------------
  ["GET", /^\/invites$/, (ctx) => {
    requireAdmin(ctx);
    return pendingInvites().sort((a, b) => b.createdAt - a.createdAt).map(sInvite);
  }],
  ["POST", /^\/invites$/, (ctx) => {
    const admin = requireAdmin(ctx);
    const email = String(ctx.body.email ?? "").trim().toLowerCase();
    const role = ctx.body.role;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw invalid(["email", "Enter a valid email address.", "invalid"]);
    if (role !== "STAFF" && role !== "ADMIN") {
      throw invalid(["role", `"${String(role ?? "")}" is not a valid choice.`, "invalid_choice"]);
    }
    if (state.users.some((u) => u.email === email)) throw bad("account_exists", "An account with this email already exists.");
    const now = Date.now();
    const invite: DInvite = {
      id: nextId(), email, role, token: (uuid() + uuid()).replace(/-/g, ""),
      createdBy: admin.id, createdAt: now, expiresAt: now + INVITE_LIFETIME, usedAt: null, revokedAt: null,
    };
    state.invites.push(invite);
    const path = `/signup?invite=${invite.token}`;
    sendMail("invite", admin.language, email, null, path, VALIDITY.week[admin.language], ROLE_NAMES[role][admin.language]);
    log(admin.name, "INVITE_SENT", `Invited ${email} as ${role.toLowerCase()}.`, { email, role });
    return new Reply(201, { ...sInvite(invite), link: `${window.location.origin}${path}` });
  }],
  ["GET", /^\/invites\/lookup$/, (ctx) => {
    const invite = pendingInvites().find((i) => i.token === ctx.query.get("token"));
    if (!invite) throw new HttpError(404, "Invitation not found.", "invite_not_found", {});
    return { email: invite.email, role: invite.role };
  }],
  ["DELETE", /^\/invites\/(\d+)$/, (ctx, [id]) => {
    requireAdmin(ctx);
    const invite = state.invites.find((i) => i.id === Number(id));
    if (!invite) throw notFound();
    invite.revokedAt ??= Date.now();
    return new Reply(204, null);
  }],
  ["GET", /^\/demo\/mailbox$/, () => state.outbox.map((m) => ({ ...m, at: iso(m.at) }))],
  ["GET", /^\/users\/me\/id-card$/, (ctx) => {
    const u = requireUser(ctx);
    return textPdf("University of Ghardaia Library - Library card", [
      `Name: ${u.name}`, `ID number: ${u.idNumber}`, `Role: ${u.role}`, `Email: ${u.email}`,
      `Member since: ${new Date(u.since).toLocaleDateString()}`, "",
      `Scan link: ${window.location.origin}/scan/${u.uuid}`, "",
      "Demo build - generated in your browser, not by the library server.",
    ]);
  }],
  ["GET", /^\/users\/([0-9a-f-]{36})\/scan$/, (ctx, [id]) => {
    requireStaff(ctx);
    const u = state.users.find((x) => x.uuid === id);
    if (!u) throw notFound();
    return {
      member: sProfile(u),
      activeRecords: recordsNewestFirst(state.records.filter((r) => r.userId === u.id && ACTIVE.includes(r.status))).map(sRecord),
    };
  }],
  // ------------------------------ books ------------------------------
  ["GET", /^\/books$/, (ctx) => {
    const matches = filterBooks(ctx);
    const sorted = orderBy(matches, ctx, { title: (b) => b.title, year: (b) => b.year, author: (b) => b.author }, "title");
    return paginate(sorted, ctx, (b) => sBook(b, ctx.user));
  }],
  ["POST", /^\/books$/, (ctx) => {
    const staff = requireStaff(ctx);
    const d = ctx.body;
    const total = Number(d.totalCopies ?? 1);
    const errors: [string, string, string][] = [];
    for (const field of ["title", "author", "isbn"] as const) {
      if (!d[field]) errors.push([field, "This field may not be blank.", "blank"]);
    }
    if (d.isbn && state.books.some((b) => b.isbn === d.isbn)) errors.push(["isbn", "book with this isbn already exists.", "unique"]);
    if (!state.categories.some((c) => c.id === Number(d.categoryId))) errors.push(["categoryId", "Pick a category.", "does_not_exist"]);
    if (!Number.isInteger(total) || total < 1) errors.push(["totalCopies", "Total copies must be at least 1.", "min_value"]);
    if (errors.length) throw invalid(...errors);
    const book: DBook = {
      id: nextId(), title: String(d.title), author: String(d.author), isbn: String(d.isbn),
      categoryId: Number(d.categoryId), publisher: String(d.publisher ?? ""),
      year: d.year ? Number(d.year) : null, totalCopies: total, availableCopies: total,
      shelfLocation: String(d.shelfLocation ?? ""), coverColor: String(d.coverColor ?? "#1F4D3A"),
      coverImage: null, description: String(d.description ?? ""),
    };
    state.books.push(book);
    log(staff.name, "BOOK_ADDED", `Added “${book.title}” (${book.totalCopies} copies) to the catalog.`,
      { title: book.title, copies: book.totalCopies });
    return new Reply(201, sBook(book));
  }],
  ["GET", /^\/books\/(\d+)$/, (ctx, [id]) => sBook(findBook(id), ctx.user)],
  ["PATCH", /^\/books\/(\d+)$/, (ctx, [id]) => updateBook(ctx, findBook(id), requireStaff(ctx))],
  ["DELETE", /^\/books\/(\d+)$/, (ctx, [id]) => {
    const staff = requireStaff(ctx);
    const book = findBook(id);
    if (book.availableCopies !== book.totalCopies) throw bad("book_on_loan", "Cannot delete: copies are currently on loan.");
    state.books = state.books.filter((b) => b.id !== book.id);
    state.records = state.records.filter((r) => r.bookId !== book.id);
    state.reservations = state.reservations.filter((r) => r.bookId !== book.id);
    log(staff.name, "BOOK_DELETED", `Removed “${book.title}” from the catalog.`, { title: book.title });
    return new Reply(204, null);
  }],
  ["POST", /^\/books\/import$/, (ctx) => {
    const staff = requireStaff(ctx);
    const rows = ctx.body.rows;
    if (!Array.isArray(rows) || !rows.every((r) => r && typeof r === "object")) throw bad("import_bad_rows", "Expected a list of rows.");
    return runImport(rows as Record<string, unknown>[], String(ctx.body.mode ?? "skip"), ctx.body.dryRun !== false,
      staff.name, String(ctx.body.filename ?? "").slice(0, 120));
  }],
  ["GET", /^\/exports\/books$/, (ctx) => {
    requireStaff(ctx);
    exportFormat(ctx);
    const sorted = [...filterBooks(ctx)].sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
    return csvDownload(BOOK_COLUMNS, sorted.map((b) => [
      b.isbn, b.title, b.author, state.categories.find((c) => c.id === b.categoryId)?.name ?? "", b.publisher, b.year,
      b.totalCopies, b.shelfLocation, b.description, b.availableCopies, freeCopies(b),
    ]));
  }],
  ["GET", /^\/exports\/loans$/, (ctx) => {
    requireStaff(ctx);
    exportFormat(ctx);
    const statuses = (ctx.query.get("status") ?? "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
    const from = exportDay(ctx, "from");
    const to = exportDay(ctx, "to");
    const list = recordsNewestFirst(state.records)
      .filter((r) => !statuses.length || statuses.includes(r.status))
      .filter((r) => from === null || r.requestedAt >= from)
      .filter((r) => to === null || r.requestedAt < to + D); // inclusive of the last day
    return csvDownload(LOAN_COLUMNS, list.map((r) => {
      const u = userById(r.userId)!;
      const b = bookById(r.bookId)!;
      return [u.name, u.idNumber, u.email, b.title, b.isbn, b.shelfLocation, r.status, stamp(r.requestedAt),
        stamp(r.borrowedAt), stamp(r.dueDate), stamp(r.returnedAt), r.renewalCount ?? 0];
    }));
  }],
  ["POST", /^\/users\/import$/, (ctx) => {
    const admin = requireAdmin(ctx);
    const rows = ctx.body.rows;
    if (!Array.isArray(rows) || !rows.every((r) => r && typeof r === "object")) throw bad("import_bad_rows", "Expected a list of rows.");
    return runStudentImport(rows as Record<string, unknown>[], ctx.body.dryRun !== false, admin.name,
      String(ctx.body.filename ?? "").slice(0, 120));
  }],
  ["GET", /^\/books\/(\d+)\/copies$/, (ctx, [id]) => {
    // Where every copy is; borrower names only for staff (mirrors BookCopiesView).
    const book = findBook(id);
    const isStaff = !!ctx.user && ctx.user.role !== "MEMBER";
    const who = (r: DRecord) => {
      if (!isStaff) return {};
      const m = userById(r.userId)!;
      return { recordId: r.id, userName: m.name, userProfileId: m.id };
    };
    const out = state.records
      .filter((r) => r.bookId === book.id && (r.status === "BORROWED" || r.status === "OVERDUE"))
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
    const held = state.records
      .filter((r) => r.bookId === book.id && r.status === "READY")
      .sort((a, b) => (a.pickupDeadline ?? 0) - (b.pickupDeadline ?? 0));
    const onShelf = Math.max(0, book.totalCopies - out.length);
    const copies: Record<string, unknown>[] = [
      // Everyone but staff sees an overdue copy as plain "on loan", without the past due date.
      ...out.map((r) => r.status === "OVERDUE" && !isStaff
        ? { state: "BORROWED", since: iso(r.borrowedAt) }
        : { state: r.status, dueDate: iso(r.dueDate), since: iso(r.borrowedAt), ...who(r) }),
      ...held.slice(0, onShelf).map((r) => ({ state: "HELD", heldUntil: iso(r.pickupDeadline), ...who(r) })),
      ...Array.from({ length: onShelf - Math.min(held.length, onShelf) }, () => ({ state: "ON_SHELF", shelf: book.shelfLocation })),
    ];
    return copies.map((c, i) => ({ ...c, copy: i + 1 }));
  }],
  ["GET", /^\/books\/(\d+)\/reservations$/, (ctx, [id]) => {
    requireStaff(ctx);
    return queueFor(Number(id)).map(sReservation);
  }],
  // ---------------------------- categories ----------------------------
  ["GET", /^\/categories$/, () => [...state.categories].sort((a, b) => a.name.localeCompare(b.name)).map(sCategory)],
  ["POST", /^\/categories$/, (ctx) => {
    requireStaff(ctx);
    const name = String(ctx.body.name ?? "").trim();
    if (!name) throw invalid(["name", "Name is required.", "blank"]);
    if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw invalid(["name", "category with this name already exists.", "unique"]);
    }
    const c = { id: nextId(), name, color: String(ctx.body.color ?? "#4A5560") };
    state.categories.push(c);
    return new Reply(201, sCategory(c));
  }],
  ["PATCH", /^\/categories\/(\d+)$/, (ctx, [id]) => {
    requireStaff(ctx);
    const c = state.categories.find((x) => x.id === Number(id));
    if (!c) throw notFound();
    if (typeof ctx.body.name === "string" && ctx.body.name.trim()) c.name = ctx.body.name.trim();
    if (typeof ctx.body.color === "string") c.color = ctx.body.color;
    return sCategory(c);
  }],
  ["DELETE", /^\/categories\/(\d+)$/, (ctx, [id]) => {
    requireStaff(ctx);
    if (state.books.some((b) => b.categoryId === Number(id))) throw bad("category_has_books", "Cannot delete a category that still has books.");
    state.categories = state.categories.filter((c) => c.id !== Number(id));
    return new Reply(204, null);
  }],
  // -------------------------- borrow records --------------------------
  ["GET", /^\/borrow-records$/, (ctx) => {
    requireStaff(ctx);
    const statuses = (ctx.query.get("status") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    const book = ctx.query.get("book");
    const user = ctx.query.get("user");
    // Loans due on or before this moment (ISO 8601); records with no due date never match.
    const dueBeforeRaw = ctx.query.get("due_before");
    const dueBefore = dueBeforeRaw ? Date.parse(dueBeforeRaw) : null;
    if (dueBeforeRaw && Number.isNaN(dueBefore)) throw invalid(["due_before", "Enter a valid date/time.", "invalid"]);
    // Every word must match somewhere (member name or ID, book title, ISBN or shelf mark), like BorrowRecordFilter.
    const words = (ctx.query.get("search") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = (r: DRecord) => {
      const m = userById(r.userId)!;
      const b = bookById(r.bookId)!;
      return [m.name, m.idNumber, b.title, b.isbn, b.shelfLocation].join("\n").toLowerCase();
    };
    const matches = state.records.filter((r) =>
      (!statuses.length || statuses.includes(r.status)) && (!book || r.bookId === Number(book)) && (!user || r.userId === Number(user))
      && (dueBefore === null || (r.dueDate !== null && r.dueDate <= dueBefore)) && words.every((w) => haystack(r).includes(w)),
    );
    const sorted = orderBy(matches, ctx, {
      requested_at: (r) => r.requestedAt, due_date: (r) => r.dueDate, pickup_deadline: (r) => r.pickupDeadline,
    }, "-requested_at");
    return paginate(sorted, ctx, sRecord);
  }],
  ["POST", /^\/borrow-records$/, (ctx) => {
    const u = requireUser(ctx);
    if (u.role !== "MEMBER") throw forbidden("members_only", "Only member accounts can request books.");
    const book = findBook(ctx.body.bookId);
    if (!u.active) throw bad("account_inactive", "Your account is deactivated.");
    if (!u.emailVerified) throw bad("email_unverified", UNVERIFIED);
    if (hasOverdue(u.id)) throw bad("overdue_block", "You have an overdue loan. Resolve it before requesting new books.");
    const limit = effectiveLimit(u);
    if (activeLoans(u.id) >= limit) {
      throw bad("borrow_limit", `Borrow limit reached (${limit}). Return a book first.`, { limit });
    }
    if (freeCopies(book) <= 0) throw bad("no_free_copy", "No copies available — join the reservation queue instead.");
    if (state.records.some((r) => r.userId === u.id && r.bookId === book.id && (r.status === "PENDING" || r.status === "READY"))) {
      throw bad("already_requested", "You already have an open request for this book.");
    }
    const r: DRecord = {
      id: nextId(), userId: u.id, bookId: book.id, requestedAt: Date.now(), approvedAt: null,
      pickupDeadline: null, borrowedAt: null, dueDate: null, returnedAt: null, status: "PENDING",
    };
    state.records.push(r);
    log(u.name, "REQUEST_CREATED", `${u.name} requested “${book.title}”.`, { member: u.name, title: book.title });
    return new Reply(201, sRecord(r));
  }],
  ["GET", /^\/borrow-records\/mine$/, (ctx) => {
    const u = requireUser(ctx);
    return recordsNewestFirst(state.records.filter((r) => r.userId === u.id)).map(sRecord);
  }],
  ["POST", /^\/borrow-records\/(\d+)\/withdraw$/, (ctx, [id]) => {
    // The owner takes back a PENDING request or READY hold; stock never changes (mirrors services.withdraw).
    const u = requireUser(ctx);
    const r = findRecord(id);
    if (r.userId !== u.id) throw forbidden("forbidden", "Only the member who made the request can withdraw it.");
    transition("withdraw", r, ["PENDING", "READY"]);
    const book = bookById(r.bookId)!;
    const wasReady = r.status === "READY";
    r.status = "CANCELLED";
    r.cancelledByMember = true;
    log(u.name, "REQUEST_WITHDRAWN", `${u.name} withdrew their request for “${book.title}”.`, { member: u.name, title: book.title });
    if (wasReady) handToQueue(book, Date.now());
    return sRecord(r);
  }],
  ["POST", /^\/borrow-records\/(\d+)\/renew$/, (ctx, [id]) => {
    // Mirrors services.renew: same checks, same order. The borrower, or staff at the desk on the member's behalf.
    const actor = requireUser(ctx);
    const r = findRecord(id);
    if (r.userId !== actor.id && actor.role === "MEMBER") {
      throw forbidden("forbidden", "Only the borrower or library staff can renew this loan.");
    }
    transition("renew", r, ["BORROWED"]);
    const owner = userById(r.userId)!;
    const book = bookById(r.bookId)!;
    const blocker = renewBlocker(r, Date.now());
    if (blocker) throw bad(blocker.code, blocker.message, blocker.params);
    const rules = state.settings;
    r.dueDate = r.dueDate! + rules.loanDays * D;
    r.renewalCount = (r.renewalCount ?? 0) + 1;
    r.dueReminderSentAt = null; // the new due date gets its own reminder
    const due = new Date(r.dueDate).toLocaleDateString();
    const onBehalf = owner.id !== actor.id;
    log(actor.name, "LOAN_RENEWED", `${actor.name} renewed “${book.title}”${onBehalf ? ` for ${owner.name}` : ""}. New due date ${due}.`,
      { member: owner.name, title: book.title, dueDate: iso(r.dueDate) });
    if (onBehalf) {
      notify(owner.id, "loan_renewed", `Staff renewed “${book.title}” for you. New due date ${due}.`,
        { title: book.title, dueDate: iso(r.dueDate) });
    }
    return sRecord(r);
  }],
  ["POST", /^\/borrow-records\/(\d+)\/approve$/, recordTransition("approve")],
  ["POST", /^\/borrow-records\/(\d+)\/reject$/, recordTransition("reject")],
  ["POST", /^\/borrow-records\/(\d+)\/confirm-pickup$/, recordTransition("pickup")],
  ["POST", /^\/borrow-records\/(\d+)\/confirm-return$/, recordTransition("return")],
  ["GET", /^\/borrow-records\/(\d+)\/document$/, (ctx, [id]) => {
    const u = requireUser(ctx);
    const r = findRecord(id);
    if (r.userId !== u.id && u.role === "MEMBER") throw forbidden("forbidden", "Forbidden.");
    const member = userById(r.userId)!;
    const book = bookById(r.bookId)!;
    return textPdf(`Borrow request REQ-${String(r.id).padStart(3, "0")}`, [
      `Member: ${member.name} (${member.idNumber})`, `Book: ${book.title}`, `Author: ${book.author}`,
      `ISBN: ${book.isbn}`, `Shelf: ${book.shelfLocation}`, `Status: ${r.status}`, "",
      `Requested: ${fmt(r.requestedAt)}`, `Approved: ${fmt(r.approvedAt)}`,
      `Pickup deadline: ${fmt(r.pickupDeadline)}`, `Borrowed: ${fmt(r.borrowedAt)}`,
      `Due: ${fmt(r.dueDate)}`, `Returned: ${fmt(r.returnedAt)}`, "",
      "Demo build - generated in your browser, not by the library server.",
    ]);
  }],
  // --------------------------- reservations ---------------------------
  ["GET", /^\/reservations$/, (ctx) => {
    const u = requireUser(ctx);
    return state.reservations.filter((r) => r.userId === u.id && r.isActive).map(sReservation);
  }],
  ["POST", /^\/reservations$/, (ctx) => {
    const u = requireUser(ctx);
    if (u.role !== "MEMBER") throw forbidden("members_only", "Only member accounts can reserve books.");
    const book = findBook(ctx.body.bookId);
    if (!u.active) throw bad("account_inactive", "Your account is deactivated.");
    if (!u.emailVerified) throw bad("email_unverified", UNVERIFIED);
    if (hasOverdue(u.id)) throw bad("overdue_block", "You have an overdue loan. Resolve it before requesting new books.");
    if (freeCopies(book) > 0) throw bad("copies_available", "Copies are available — submit a borrow request instead.");
    if (queueFor(book.id).some((r) => r.userId === u.id)) {
      throw bad("already_queued", "You are already in the reservation queue for this book.");
    }
    const r: DReservation = { id: nextId(), userId: u.id, bookId: book.id, reservedAt: Date.now(), isActive: true };
    state.reservations.push(r);
    const position = queueFor(book.id).findIndex((x) => x.id === r.id) + 1;
    log(u.name, "RESERVED", `${u.name} joined the queue for “${book.title}” (position ${position}).`,
      { member: u.name, title: book.title, position });
    notify(u.id, "queue_joined", `You joined the reservation queue for “${book.title}” at position ${position}.`,
      { title: book.title, position });
    return new Reply(201, sReservation(r));
  }],
  ["DELETE", /^\/reservations\/(\d+)$/, (ctx, [id]) => {
    const u = requireUser(ctx);
    const r = state.reservations.find((x) => x.id === Number(id));
    if (!r) throw notFound();
    if (r.userId !== u.id) throw forbidden("forbidden", "Only the member on the waiting list can leave it.");
    if (!r.isActive) throw notFound();
    r.isActive = false;
    return new Reply(204, null);
  }],
  ["GET", /^\/reservations\/all$/, (ctx) => {
    requireStaff(ctx);
    return state.reservations.filter((r) => r.isActive).sort((a, b) => a.reservedAt - b.reservedAt).map(sReservation);
  }],
  // ------------------------------ users ------------------------------
  ["GET", /^\/users$/, (ctx) => {
    requireStaff(ctx);
    const search = ctx.query.get("search")?.toLowerCase();
    const role = ctx.query.get("role");
    // Django matches first and last name separately: the first word is the first name.
    const names = (u: DUser) => [u.name.split(" ")[0], u.name.split(" ").slice(1).join(" ")];
    const matches = state.users
      .filter((u) => !search || [...names(u), u.email, u.idNumber].some((f) => f.toLowerCase().includes(search)))
      .filter((u) => !role || u.role === role);
    return paginate(orderBy(matches, ctx, { name: (u) => u.name }, "name"), ctx, sProfile);
  }],
  ["GET", /^\/users\/(\d+)$/, (ctx, [id]) => {
    requireStaff(ctx);
    const u = userById(Number(id));
    if (!u) throw notFound();
    return { member: sProfile(u), records: recordsNewestFirst(state.records.filter((r) => r.userId === u.id)).map(sRecord) };
  }],
  ["DELETE", /^\/users\/(\d+)\/delete$/, (ctx, [id]) => {
    const admin = requireAdmin(ctx);
    const u = userById(Number(id));
    if (!u) throw notFound();
    if (u.id === admin.id) throw bad("cannot_delete_self", "You cannot delete your own account.");
    // Undo the stock effect of copies this member still holds, as a cascade delete would lose them.
    for (const r of state.records.filter((x) => x.userId === u.id && (x.status === "BORROWED" || x.status === "OVERDUE"))) {
      const book = bookById(r.bookId);
      if (book) book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
    }
    state.users = state.users.filter((x) => x.id !== u.id);
    state.records = state.records.filter((r) => r.userId !== u.id);
    state.reservations = state.reservations.filter((r) => r.userId !== u.id);
    state.notifications = state.notifications.filter((n) => n.userId !== u.id);
    log(admin.name, "ACCOUNT_DELETED", `Deleted ${u.name}'s account.`, { member: u.name });
    return new Reply(204, null);
  }],
  // ---------------------------- dashboard etc ----------------------------
  ["GET", /^\/dashboard\/stats$/, (ctx) => {
    requireStaff(ctx);
    const count = (s: BorrowStatus) => state.records.filter((r) => r.status === s).length;
    return {
      totalBooks: state.books.reduce((n, b) => n + b.totalCopies, 0),
      totalBorrowed: count("BORROWED"), totalReady: count("READY"), totalOverdue: count("OVERDUE"),
      totalMembers: state.users.filter((u) => u.role === "MEMBER" && u.active).length,
    };
  }],
  ["GET", /^\/analytics$/, (ctx) => {
    requireStaff(ctx);
    const statusDistribution: Record<string, number> = {};
    const byCategory = new Map<number, number>();
    const byBook = new Map<number, number>();
    for (const r of state.records) {
      statusDistribution[r.status] = (statusDistribution[r.status] ?? 0) + 1;
      const book = bookById(r.bookId);
      if (book) byCategory.set(book.categoryId, (byCategory.get(book.categoryId) ?? 0) + 1);
      byBook.set(r.bookId, (byBook.get(r.bookId) ?? 0) + 1);
    }
    const categoryLoans = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cid, loans]) => {
      const c = state.categories.find((x) => x.id === cid);
      return { name: c?.name ?? "Uncategorized", color: c?.color ?? "#4A5560", loans };
    });
    const monthly = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      const inRange = (t: number | null) => t != null && t >= start && t < end;
      monthly.push({
        month: new Date(start).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        loans: state.records.filter((r) => inRange(r.borrowedAt)).length,
        returns: state.records.filter((r) => inRange(r.returnedAt)).length,
        newMembers: state.users.filter((u) => inRange(u.since)).length,
      });
    }
    const topBooks = [...byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([bid, requests]) => ({ title: bookById(bid)?.title ?? "—", requests }));
    const fulfilled = state.records.filter((r) => ["RETURNED", "BORROWED", "OVERDUE"].includes(r.status)).length;
    return {
      statusDistribution, categoryLoans, monthly, topBooks,
      activeReservations: state.reservations.filter((r) => r.isActive).length,
      fulfillmentRate: Math.round((1000 * fulfilled) / Math.max(1, state.records.length)) / 10,
    };
  }],
  ["GET", /^\/activity$/, (ctx) => {
    requireStaff(ctx);
    return [...state.activity].sort((a, b) => b.at - a.at).slice(0, 50).map((a) => ({ ...a, at: iso(a.at) }));
  }],
  ["GET", /^\/notifications\/mine$/, (ctx) => {
    const u = requireUser(ctx);
    return state.notifications.filter((n) => n.userId === u.id).sort((a, b) => b.at - a.at).slice(0, 20)
      .map(({ id, at, code, params, message, read }) => ({ id, at: iso(at), code, params, message, read }));
  }],
  ["POST", /^\/notifications\/read$/, (ctx) => {
    const u = requireUser(ctx);
    state.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; });
    return { ok: true };
  }],
  // ----------------------------- settings -----------------------------
  ["GET", /^\/settings$/, (ctx) => {
    // Everyone reads the four rules that appear in the interface copy; admins read everything.
    const s = state.settings;
    if (ctx.user?.role === "ADMIN") return sSettingsAdmin();
    return { holdHours: s.holdHours, loanDays: s.loanDays, maxRenewals: s.maxRenewals, renewWindowDays: RENEW_WINDOW_DAYS };
  }],
  ["PATCH", /^\/settings$/, (ctx) => {
    const admin = requireAdmin(ctx);
    const s = state.settings;
    const errors: [string, string, string][] = [];
    const next: Partial<Record<SettingField, number>> = {};
    for (const [field, [min, max]] of Object.entries(SETTING_BOUNDS) as [SettingField, [number, number]][]) {
      if (!(field in ctx.body)) continue;
      const raw = ctx.body[field];
      const n = typeof raw === "number" && Number.isInteger(raw) ? raw
        : typeof raw === "string" && /^[+-]?\d+$/.test(raw.trim()) ? Number(raw) : null;
      if (n === null) errors.push([field, "A valid integer is required.", "invalid"]);
      else if (n < min) errors.push([field, `Ensure this value is greater than or equal to ${min}.`, "min_value"]);
      else if (n > max) errors.push([field, `Ensure this value is less than or equal to ${max}.`, "max_value"]);
      else next[field] = n;
    }
    if (errors.length) throw invalid(...errors);
    const changes = Object.fromEntries(
      (Object.entries(next) as [SettingField, number][]).filter(([field, value]) => s[field] !== value),
    ) as Partial<Record<SettingField, number>>;
    if (Object.keys(changes).length) {
      Object.assign(s, changes, { updatedAt: Date.now(), updatedBy: admin.id });
      const detail = (Object.entries(changes) as [SettingField, number][]).map(([f, v]) => `${SETTING_LABELS[f]} → ${v}`).join(", ");
      log(admin.name, "SETTINGS_CHANGED", `Changed the library rules: ${detail}.`, changes);
    }
    return sSettingsAdmin();
  }],
  // --------------------------- site photographs ---------------------------
  ["GET", /^\/site-images$/, () => Object.fromEntries(SITE_SLOTS.map((slot) => [slot, sSiteImage(state.siteImages[slot])]))],
  ["PUT", /^\/site-images\/([^/]+)$/, async (ctx, [raw]) => {
    const admin = requireAdmin(ctx);
    const slot = siteSlot(raw);
    const field = (name: string) => {
      const value = ctx.form?.get(name);
      return typeof value === "string" ? value.trim() : "";
    };
    if (!field("altEn") || !field("altFr") || !field("altAr")) {
      throw bad("alt_required", "Describe the photograph in English, French and Arabic.");
    }
    const texts = {
      altEn: siteText(field("altEn"), "alt_en"), altFr: siteText(field("altFr"), "alt_fr"), altAr: siteText(field("altAr"), "alt_ar"),
      credit: siteText(field("credit"), "credit"),
    };
    const encoded = await encodeSiteImage(ctx.form?.get("file"), slot);
    const previous = state.siteImages[slot];
    state.siteImages[slot] = { ...encoded, ...texts, updatedAt: Date.now() };
    // localStorage holds a few megabytes: say so, and keep the old photograph, rather than lose the change on reload.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      if (previous) state.siteImages[slot] = previous;
      else delete state.siteImages[slot];
      throw bad("demo_storage_full", "The demo cannot store a photograph this large in the browser.");
    }
    log(admin.name, "SITE_IMAGE_CHANGED", `Replaced the ${SITE_SLOT_NAMES[slot]} photograph.`, { slot });
    return sSiteImage(state.siteImages[slot]);
  }],
  ["DELETE", /^\/site-images\/([^/]+)$/, (ctx, [raw]) => {
    const admin = requireAdmin(ctx);
    const slot = siteSlot(raw);
    if (state.siteImages[slot]) {
      delete state.siteImages[slot];
      log(admin.name, "SITE_IMAGE_RESET", `Restored the default ${SITE_SLOT_NAMES[slot]} photograph.`, { slot });
    }
    return new Reply(204, null);
  }],
  ["POST", /^\/jobs\/run$/, (ctx) => {
    requireStaff(ctx);
    return runJobs();
  }],
];

function json(status: number, data: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Drop-in replacement for `fetch` against the API. `url` must include the
 * `/api` prefix (as built by API_ROOT); anything else goes to the real fetch.
 */
export async function demoFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url, window.location.origin);
  const idx = parsed.pathname.indexOf("/api/");
  if (idx < 0) return fetch(url, init);
  const path = parsed.pathname.slice(idx + 4).replace(/\/+$/, "");
  const method = (init.method ?? "GET").toUpperCase();

  const headers = new Headers(init.headers);
  const token = headers.get("Authorization")?.replace(/^Bearer\s+demo\./, "");
  const user = token ? userById(Number(token)) ?? null : null;
  if (headers.has("Authorization") && (!user || !user.active)) {
    return json(401, { detail: "Given token not valid for any token type" });
  }

  const form = init.body instanceof FormData ? init.body : null;
  let body: Record<string, unknown> = {};
  if (typeof init.body === "string") {
    try { body = JSON.parse(init.body); } catch { return json(400, { detail: "Malformed JSON." }); }
  }

  // Small delay so loading states render the way they would against a server. A keepalive request
  // is the page's last word before it unloads: it must be applied and saved without waiting.
  if (!init.keepalive) await new Promise((r) => setTimeout(r, 120));

  for (const [m, re, handler] of ROUTES) {
    const match = m === method && re.exec(path);
    if (!match) continue;
    try {
      // Stand-in for the cron jobs: expire pickups / flag overdue loans before serving.
      const jobs = runJobs();
      const handled = handler({ method, path, query: parsed.searchParams, body, form, user, headers }, match.slice(1));
      const result = handled instanceof Promise ? await handled : handled; // no await for sync handlers: see keepalive
      if (method !== "GET" || jobs.cancelled || jobs.flaggedOverdue || jobs.remindersSent) save();
      if (result instanceof Blob) return new Response(result, { status: 200, headers: { "Content-Type": result.type } });
      if (result instanceof Reply) return json(result.status, result.data);
      return json(200, result);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, e.body);
      console.error("[demo api]", e);
      return json(500, { detail: "Demo backend error." });
    }
  }
  return json(404, { detail: "Not found.", code: "not_found" });
}
