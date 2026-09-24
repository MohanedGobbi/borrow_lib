/**
 * In-browser stand-in for the Django API, used by static demo builds
 * (`npm run build:demo`, e.g. on Vercel). It answers the same `/api/...`
 * routes with the same JSON shapes and enforces the same business rules as
 * backend/library/services.py. State is seeded from the `seed_demo` dataset
 * and persisted to localStorage so the demo survives reloads.
 */
import { DEMO_STORAGE_KEY as STORAGE_KEY } from "@/api/client";
import type { BorrowStatus, Role } from "@/types";

const PASSWORD = "password123";
const STAFF_INVITE_CODE = "LIB-STAFF-2024";
const H = 60 * 60 * 1000;
const D = 24 * H;
const PICKUP_WINDOW = 48 * H;
const LOAN_PERIOD = 14 * D;
const ACTIVE: BorrowStatus[] = ["PENDING", "READY", "BORROWED", "OVERDUE"];

interface DCategory { id: number; name: string; color: string }
interface DBook {
  id: number; title: string; author: string; isbn: string; categoryId: number; publisher: string;
  year: number | null; totalCopies: number; availableCopies: number; shelfLocation: string;
  coverColor: string; coverImage: string | null; description: string;
}
interface DUser {
  id: number; uuid: string; name: string; email: string; password: string; idNumber: string;
  phone: string; address: string; role: Role; since: number; maxLimit: number; active: boolean;
}
interface DRecord {
  id: number; userId: number; bookId: number; requestedAt: number; approvedAt: number | null;
  pickupDeadline: number | null; borrowedAt: number | null; dueDate: number | null;
  returnedAt: number | null; status: BorrowStatus;
}
interface DReservation { id: number; userId: number; bookId: number; reservedAt: number; isActive: boolean }
interface DActivity { id: number; at: number; actorName: string; action: string; detail: string }
interface DNotification { id: number; userId: number; at: number; message: string; read: boolean }

interface DemoState {
  seq: number;
  categories: DCategory[];
  books: DBook[];
  users: DUser[];
  records: DRecord[];
  reservations: DReservation[];
  activity: DActivity[];
  notifications: DNotification[];
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
];

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
    seq: 1000, categories: [], books: [], users: [], records: [], reservations: [], activity: [], notifications: [],
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
      since: now - sinceDays * D, maxLimit: role === "MEMBER" ? 5 : 10, active: true,
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
  const trail = (at: number | null, actorName: string, action: string, detail: string) => {
    if (at != null) s.activity.push({ id: ++aid, at, actorName, action, detail });
  };
  for (const r of s.records) {
    const who = name(r.userId);
    const what = title(r.bookId);
    trail(r.requestedAt, who, "REQUEST_CREATED", `${who} requested “${what}”.`);
    if (r.status === "REJECTED") trail(r.requestedAt + 3 * H, staffName, "REJECTED", `Rejected ${who}'s request for “${what}”.`);
    trail(r.approvedAt, staffName, "APPROVED", `Approved ${who}'s request for “${what}”. Pickup within 48h.`);
    if (r.status === "CANCELLED") trail(r.pickupDeadline, "System", "AUTO_CANCELLED", `${who} missed the 48h pickup window for “${what}”. Request auto-cancelled.`);
    trail(r.borrowedAt, staffName, "PICKUP_CONFIRMED", `${who} picked up “${what}”. Due in 14 days.`);
    trail(r.returnedAt, staffName, "RETURN_CONFIRMED", `${who} returned “${what}”.`);
    if (r.status === "OVERDUE") trail(r.dueDate! + 12 * H, "System", "MARKED_OVERDUE", `${who}'s loan of “${what}” is now overdue.`);
  }
  s.activity = s.activity.filter((a) => a.at <= now).sort((a, b) => b.at - a.at);
  s.notifications.push({ id: 1, userId: daniel, at: now, read: false,
    message: "Your pickup window for “Thinking, Fast and Slow” closes soon." });
  return s;
}

// ------------------------------ storage ------------------------------

const state: DemoState = load();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
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
const activeLoans = (userId: number) => state.records.filter((r) => r.userId === userId && ACTIVE.includes(r.status)).length;
const queueFor = (bookId: number) =>
  state.reservations.filter((r) => r.bookId === bookId && r.isActive).sort((a, b) => a.reservedAt - b.reservedAt);

function sCategory(c: DCategory) {
  return { id: c.id, name: c.name, color: c.color, bookCount: state.books.filter((b) => b.categoryId === c.id).length };
}

function sBook(b: DBook) {
  const { categoryId, ...rest } = b;
  return { ...rest, category: sCategory(state.categories.find((c) => c.id === categoryId)!) };
}

function sProfile(u: DUser) {
  return {
    id: u.id, uuid: u.uuid, name: u.name, email: u.email, studentOrStaffId: u.idNumber,
    phoneNumber: u.phone, address: u.address, role: u.role,
    membershipStartDate: new Date(u.since).toISOString().slice(0, 10),
    maxBorrowLimit: u.maxLimit, active: u.active, activeLoans: activeLoans(u.id), hasOverdue: hasOverdue(u.id),
  };
}

function sRecord(r: DRecord) {
  const u = userById(r.userId)!;
  const b = bookById(r.bookId)!;
  return {
    id: r.id, userId: u.id, userProfileId: u.id, bookId: b.id, userName: u.name, userIdNumber: u.idNumber,
    bookTitle: b.title, bookShelf: b.shelfLocation, requestedAt: iso(r.requestedAt), approvedAt: iso(r.approvedAt),
    pickupDeadline: iso(r.pickupDeadline), borrowedAt: iso(r.borrowedAt), dueDate: iso(r.dueDate),
    returnedAt: iso(r.returnedAt), status: r.status,
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

class HttpError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
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

const bad = (detail: string) => new HttpError(400, detail);
const notFound = () => new HttpError(404, "Not found.");

function log(actorName: string, action: string, detail: string) {
  state.activity.unshift({ id: nextId(), at: Date.now(), actorName, action, detail });
}

function notify(userId: number, message: string) {
  state.notifications.unshift({ id: nextId(), userId, at: Date.now(), message, read: false });
}

function transition(op: string, r: DRecord, allowed: BorrowStatus[]) {
  if (!allowed.includes(r.status)) {
    throw new HttpError(409, `Invalid transition: cannot ${op} a record in status ${r.status}.`);
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
    log("System", "AUTO_CANCELLED", `${user.name} missed the 48h pickup window for “${book.title}”. Request auto-cancelled.`);
    notify(user.id, `Your request for “${book.title}” was auto-cancelled after the 48h pickup window expired.`);
    const nxt = queueFor(book.id)[0];
    if (nxt) {
      nxt.isActive = false;
      state.records.push({
        id: nextId(), userId: nxt.userId, bookId: book.id, requestedAt: nxt.reservedAt, approvedAt: now,
        pickupDeadline: now + PICKUP_WINDOW, borrowedAt: null, dueDate: null, returnedAt: null, status: "READY",
      });
      const nu = userById(nxt.userId)!;
      log("System", "QUEUE_HANDOFF", `Reservation queue: “${book.title}” is now held for ${nu.name} (fresh 48h window).`);
      notify(nu.id, `Good news — “${book.title}” is now held for you. Pick it up within 48 hours.`);
    }
  }
  for (const r of state.records.filter((x) => x.status === "BORROWED" && (x.dueDate ?? Infinity) < now)) {
    const user = userById(r.userId)!;
    const book = bookById(r.bookId)!;
    r.status = "OVERDUE";
    flaggedOverdue++;
    log("System", "MARKED_OVERDUE", `${user.name}'s loan of “${book.title}” is now overdue.`);
    notify(user.id, `“${book.title}” is overdue. Please return it — new requests are blocked until resolved.`);
  }
  return { cancelled, flaggedOverdue };
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
}

type Handler = (ctx: Ctx, params: string[]) => unknown | Promise<unknown>;

function requireUser(ctx: Ctx): DUser {
  if (!ctx.user) throw new HttpError(401, "Authentication credentials were not provided.");
  return ctx.user;
}

function requireStaff(ctx: Ctx): DUser {
  const u = requireUser(ctx);
  if (u.role === "MEMBER") throw new HttpError(403, "Forbidden: staff or admin role required.");
  return u;
}

function requireAdmin(ctx: Ctx): DUser {
  const u = requireUser(ctx);
  if (u.role !== "ADMIN") throw new HttpError(403, "Forbidden: admin role required.");
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
    if (!Number.isInteger(total) || total < 1) throw bad("Total copies must be at least 1.");
    if (total < onLoan) throw bad(`Cannot set total below ${onLoan} — that many copies are on loan.`);
    book.totalCopies = total;
    book.availableCopies = total - onLoan;
  }
  for (const key of ["title", "author", "isbn", "publisher", "shelfLocation", "coverColor", "description"] as const) {
    if (typeof src[key] === "string") book[key] = src[key] as string;
  }
  if (src.year !== undefined) book.year = src.year === "" || src.year === null ? null : Number(src.year);
  if (src.categoryId !== undefined) {
    if (!state.categories.some((c) => c.id === Number(src.categoryId))) throw bad("Invalid category.");
    book.categoryId = Number(src.categoryId);
  }
  if (src.coverImage instanceof File) book.coverImage = await fileToDataUrl(src.coverImage);
  else if (src.coverImage === null || src.coverImage === "") book.coverImage = null;
  log(actor.name, "BOOK_UPDATED", `Updated “${book.title}”.`);
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
      Object.assign(r, { status: "READY", approvedAt: now, pickupDeadline: now + PICKUP_WINDOW });
      log(staff.name, "APPROVED", `Approved ${user.name}'s request for “${book.title}”. Pickup within 48h.`);
      notify(user.id, `Your request for “${book.title}” was approved. Pick it up within 48 hours.`);
    } else if (op === "reject") {
      transition("reject", r, ["PENDING"]);
      r.status = "REJECTED";
      log(staff.name, "REJECTED", `Rejected ${user.name}'s request for “${book.title}”.`);
      notify(user.id, `Your request for “${book.title}” was rejected by staff.`);
    } else if (op === "pickup") {
      transition("pickup", r, ["READY"]);
      if (book.availableCopies <= 0) throw bad("No physical copy on the shelf to hand out.");
      Object.assign(r, { status: "BORROWED", borrowedAt: now, dueDate: now + LOAN_PERIOD });
      book.availableCopies -= 1;
      log(staff.name, "PICKUP_CONFIRMED", `${user.name} picked up “${book.title}”. Due in 14 days.`);
      notify(user.id, `You picked up “${book.title}”. Due back on ${new Date(r.dueDate!).toLocaleDateString()}.`);
    } else {
      transition("return", r, ["BORROWED", "OVERDUE"]);
      Object.assign(r, { status: "RETURNED", returnedAt: now });
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      log(staff.name, "RETURN_CONFIRMED", `${user.name} returned “${book.title}”.`);
    }
    return sRecord(r);
  };
}

const ROUTES: [string, RegExp, Handler][] = [
  // ------------------------------ auth ------------------------------
  ["POST", /^\/auth\/login$/, (ctx) => {
    const email = String(ctx.body.username ?? "").trim().toLowerCase();
    const u = state.users.find((x) => x.email === email);
    if (!u || u.password !== ctx.body.password || !u.active) {
      throw new HttpError(401, "No active account found with the given credentials");
    }
    return { access: `demo.${u.id}`, refresh: `demo.${u.id}` };
  }],
  ["POST", /^\/auth\/refresh$/, (ctx) => {
    const id = Number(String(ctx.body.refresh ?? "").replace("demo.", ""));
    if (!userById(id)) throw new HttpError(401, "Token is invalid or expired");
    return { access: `demo.${id}` };
  }],
  ["POST", /^\/auth\/register$/, (ctx) => {
    const d = ctx.body as Record<string, string | undefined>;
    const email = (d.email ?? "").trim().toLowerCase();
    const errors: string[] = [];
    if (!d.name?.trim()) errors.push("Name is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Enter a valid email address.");
    // Mirrors Django's password validators (length, all-numeric, common, similar to the email).
    const pw = d.password ?? "";
    if (pw.length < 8) errors.push("This password is too short. It must contain at least 8 characters.");
    else if (/^\d+$/.test(pw)) errors.push("This password is entirely numeric.");
    else if (["password", "password1", "12345678", "qwertyuiop", "iloveyou", "azertyuiop"].includes(pw.toLowerCase())) {
      errors.push("This password is too common.");
    } else if (email && pw.toLowerCase().includes(email.split("@")[0])) {
      errors.push("The password is too similar to the email address.");
    }
    if (!d.studentId?.trim()) errors.push("Student ID is required.");
    if (state.users.some((u) => u.email === email)) errors.push("An account with this email already exists.");
    if (state.users.some((u) => u.idNumber.toLowerCase() === (d.studentId ?? "").toLowerCase())) {
      errors.push("This ID is already registered.");
    }
    if (errors.length) throw bad(errors.join(" "));
    let role: Role = "MEMBER";
    if (d.staffInviteCode) {
      if (d.staffInviteCode !== STAFF_INVITE_CODE) throw new HttpError(403, "Invalid staff invite code.");
      role = "STAFF";
    }
    const u: DUser = {
      id: nextId(), uuid: uuid(), name: d.name!.trim(), email, password: d.password!, idNumber: d.studentId!.trim(),
      phone: d.phoneNumber ?? "", address: d.address ?? "", role, since: Date.now(),
      maxLimit: role === "STAFF" ? 10 : 5, active: true,
    };
    state.users.push(u);
    log("System", "REGISTERED", `${u.name} registered as ${role.toLowerCase()}.`);
    return new Reply(201, sProfile(u));
  }],
  ["GET", /^\/users\/me$/, (ctx) => sProfile(requireUser(ctx))],
  ["PATCH", /^\/users\/me$/, (ctx) => {
    const u = requireUser(ctx);
    if (typeof ctx.body.phoneNumber === "string") u.phone = ctx.body.phoneNumber;
    if (typeof ctx.body.address === "string") u.address = ctx.body.address;
    return sProfile(u);
  }],
  ["GET", /^\/users\/me\/id-card$/, (ctx) => {
    const u = requireUser(ctx);
    return textPdf("University Library - Library card", [
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
    const search = ctx.query.get("search")?.toLowerCase();
    const category = ctx.query.get("category");
    return state.books
      .filter((b) => !search || [b.title, b.author, b.isbn].some((f) => f.toLowerCase().includes(search)))
      .filter((b) => !category || state.categories.find((c) => c.id === b.categoryId)?.name === category)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(sBook);
  }],
  ["POST", /^\/books$/, (ctx) => {
    const staff = requireStaff(ctx);
    const d = ctx.body;
    const total = Number(d.totalCopies ?? 1);
    if (!d.title || !d.author || !d.isbn) throw bad("Title, author and ISBN are required.");
    if (state.books.some((b) => b.isbn === d.isbn)) throw bad("book with this isbn already exists.");
    if (!state.categories.some((c) => c.id === Number(d.categoryId))) throw bad("Pick a category.");
    if (!Number.isInteger(total) || total < 1) throw bad("Total copies must be at least 1.");
    const book: DBook = {
      id: nextId(), title: String(d.title), author: String(d.author), isbn: String(d.isbn),
      categoryId: Number(d.categoryId), publisher: String(d.publisher ?? ""),
      year: d.year ? Number(d.year) : null, totalCopies: total, availableCopies: total,
      shelfLocation: String(d.shelfLocation ?? ""), coverColor: String(d.coverColor ?? "#1F4D3A"),
      coverImage: null, description: String(d.description ?? ""),
    };
    state.books.push(book);
    log(staff.name, "BOOK_ADDED", `Added “${book.title}” (${book.totalCopies} copies) to the catalog.`);
    return new Reply(201, sBook(book));
  }],
  ["GET", /^\/books\/(\d+)$/, (_ctx, [id]) => sBook(findBook(id))],
  ["PATCH", /^\/books\/(\d+)$/, (ctx, [id]) => updateBook(ctx, findBook(id), requireStaff(ctx))],
  ["DELETE", /^\/books\/(\d+)$/, (ctx, [id]) => {
    const staff = requireStaff(ctx);
    const book = findBook(id);
    if (book.availableCopies !== book.totalCopies) throw bad("Cannot delete: copies are currently on loan.");
    state.books = state.books.filter((b) => b.id !== book.id);
    state.records = state.records.filter((r) => r.bookId !== book.id);
    state.reservations = state.reservations.filter((r) => r.bookId !== book.id);
    log(staff.name, "BOOK_DELETED", `Removed “${book.title}” from the catalog.`);
    return new Reply(204, null);
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
      ...out.map((r) => ({ state: r.status, dueDate: iso(r.dueDate), since: iso(r.borrowedAt), ...who(r) })),
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
    if (!name) throw bad("Name is required.");
    if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw bad("category with this name already exists.");
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
    if (state.books.some((b) => b.categoryId === Number(id))) throw bad("Cannot delete a category that still has books.");
    state.categories = state.categories.filter((c) => c.id !== Number(id));
    return new Reply(204, null);
  }],
  // -------------------------- borrow records --------------------------
  ["GET", /^\/borrow-records$/, (ctx) => {
    requireStaff(ctx);
    const status = ctx.query.get("status");
    const book = ctx.query.get("book");
    const user = ctx.query.get("user");
    return recordsNewestFirst(state.records.filter((r) =>
      (!status || r.status === status) && (!book || r.bookId === Number(book)) && (!user || r.userId === Number(user)),
    )).map(sRecord);
  }],
  ["POST", /^\/borrow-records$/, (ctx) => {
    const u = requireUser(ctx);
    if (u.role !== "MEMBER") throw new HttpError(403, "Only member accounts can request books.");
    const book = findBook(ctx.body.bookId);
    if (hasOverdue(u.id)) throw bad("You have an overdue loan. Resolve it before requesting new books.");
    if (activeLoans(u.id) >= u.maxLimit) throw bad(`Borrow limit reached (${u.maxLimit}). Return a book first.`);
    if (book.availableCopies <= 0) throw bad("No copies available — join the reservation queue instead.");
    if (state.records.some((r) => r.userId === u.id && r.bookId === book.id && (r.status === "PENDING" || r.status === "READY"))) {
      throw bad("You already have an open request for this book.");
    }
    const r: DRecord = {
      id: nextId(), userId: u.id, bookId: book.id, requestedAt: Date.now(), approvedAt: null,
      pickupDeadline: null, borrowedAt: null, dueDate: null, returnedAt: null, status: "PENDING",
    };
    state.records.push(r);
    log(u.name, "REQUEST_CREATED", `${u.name} requested “${book.title}”.`);
    return new Reply(201, sRecord(r));
  }],
  ["GET", /^\/borrow-records\/mine$/, (ctx) => {
    const u = requireUser(ctx);
    return recordsNewestFirst(state.records.filter((r) => r.userId === u.id)).map(sRecord);
  }],
  ["POST", /^\/borrow-records\/(\d+)\/approve$/, recordTransition("approve")],
  ["POST", /^\/borrow-records\/(\d+)\/reject$/, recordTransition("reject")],
  ["POST", /^\/borrow-records\/(\d+)\/confirm-pickup$/, recordTransition("pickup")],
  ["POST", /^\/borrow-records\/(\d+)\/confirm-return$/, recordTransition("return")],
  ["GET", /^\/borrow-records\/(\d+)\/document$/, (ctx, [id]) => {
    const u = requireUser(ctx);
    const r = findRecord(id);
    if (r.userId !== u.id && u.role === "MEMBER") throw new HttpError(403, "Forbidden.");
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
    if (u.role !== "MEMBER") throw new HttpError(403, "Only member accounts can reserve books.");
    const book = findBook(ctx.body.bookId);
    if (book.availableCopies > 0) throw bad("Copies are available — submit a borrow request instead.");
    if (queueFor(book.id).some((r) => r.userId === u.id)) throw bad("You are already in the reservation queue for this book.");
    const r: DReservation = { id: nextId(), userId: u.id, bookId: book.id, reservedAt: Date.now(), isActive: true };
    state.reservations.push(r);
    const position = queueFor(book.id).findIndex((x) => x.id === r.id) + 1;
    log(u.name, "RESERVED", `${u.name} joined the queue for “${book.title}” (position ${position}).`);
    notify(u.id, `You joined the reservation queue for “${book.title}” at position ${position}.`);
    return new Reply(201, sReservation(r));
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
    return state.users
      .filter((u) => !search || [u.name, u.email, u.idNumber].some((f) => f.toLowerCase().includes(search)))
      .filter((u) => !role || u.role === role)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(sProfile);
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
    if (u.id === admin.id) throw bad("You cannot delete your own account.");
    // Undo the stock effect of copies this member still holds, as a cascade delete would lose them.
    for (const r of state.records.filter((x) => x.userId === u.id && (x.status === "BORROWED" || x.status === "OVERDUE"))) {
      const book = bookById(r.bookId);
      if (book) book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
    }
    state.users = state.users.filter((x) => x.id !== u.id);
    state.records = state.records.filter((r) => r.userId !== u.id);
    state.reservations = state.reservations.filter((r) => r.userId !== u.id);
    state.notifications = state.notifications.filter((n) => n.userId !== u.id);
    log(admin.name, "ACCOUNT_DELETED", `Deleted ${u.name}'s account.`);
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
      .map(({ id, at, message, read }) => ({ id, at: iso(at), message, read }));
  }],
  ["POST", /^\/notifications\/read$/, (ctx) => {
    const u = requireUser(ctx);
    state.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; });
    return { ok: true };
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

  // Small delay so loading states render the way they would against a server.
  await new Promise((r) => setTimeout(r, 120));

  for (const [m, re, handler] of ROUTES) {
    const match = m === method && re.exec(path);
    if (!match) continue;
    try {
      // Stand-in for the cron jobs: expire pickups / flag overdue loans before serving.
      const jobs = runJobs();
      const result = await handler({ method, path, query: parsed.searchParams, body, form, user }, match.slice(1));
      if (method !== "GET" || jobs.cancelled || jobs.flaggedOverdue) save();
      if (result instanceof Blob) return new Response(result, { status: 200, headers: { "Content-Type": result.type } });
      if (result instanceof Reply) return json(result.status, result.data);
      return json(200, result);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { detail: e.message });
      console.error("[demo api]", e);
      return json(500, { detail: "Demo backend error." });
    }
  }
  return json(404, { detail: "Not found." });
}
