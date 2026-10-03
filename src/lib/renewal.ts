import { fmtDate, msLeft } from "@/lib/time";
import type { BorrowRecord, LibraryRules } from "@/types";

const DAY_MS = 86_400_000;

/** Whether a loan can be renewed now; when it cannot, the text key (and values) that say why. */
export type RenewalState =
  | { ok: true }
  | { ok: false; reason: { key: string; vars?: Record<string, string | number> } };

/**
 * The same checks, in the same order, as services.renew on the server: an overdue loan of the member,
 * renewals used up, someone waiting, and a due date still outside the renewal window.
 * `audience` only changes whose overdue loan the sentence talks about.
 */
export function renewalState(r: BorrowRecord, rules: LibraryRules, audience: "member" | "staff"): RenewalState {
  if (r.memberHasOverdue) {
    return { ok: false, reason: { key: audience === "member" ? "renew.overdue" : "renew.overdueMember" } };
  }
  if (r.renewalCount >= rules.maxRenewals) {
    const key = rules.maxRenewals === 0 ? "renew.off" : r.renewalCount === 1 ? "renew.limitOnce" : "renew.limitMany";
    return { ok: false, reason: { key, vars: { n: r.renewalCount } } };
  }
  if (r.bookHasQueue) return { ok: false, reason: { key: "renew.queue" } };
  const windowMs = rules.renewWindowDays * DAY_MS;
  if (r.dueDate && msLeft(r.dueDate) > windowMs) {
    return { ok: false, reason: { key: "renew.from", vars: { date: fmtDate(Date.parse(r.dueDate) - windowMs) } } };
  }
  return { ok: true };
}
