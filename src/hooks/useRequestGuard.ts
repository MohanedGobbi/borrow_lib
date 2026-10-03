import { useQuery } from "@tanstack/react-query";
import { apiRecords } from "@/api";
import { qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";

const ACTIVE = ["PENDING", "READY", "BORROWED", "OVERDUE"];

export interface RequestGuard {
  /** Why a request would fail right now; null when the student can request. */
  kind: "overdue" | "limit" | null;
  /** The tooltip / accessible reason for a disabled Request or Join button. */
  reason?: string;
  /** The slim notice shown at the top of the catalog and the book page. */
  notice?: string;
}

/**
 * What the server would answer to a new request from the signed-in student, known before they click:
 * an overdue loan blocks it (`overdue_block`) and so does a full borrowing limit (`borrow_limit`).
 * The student's own records are the source (shared with My loans and refreshed after every circulation change),
 * so the guard follows a request or a return without a reload; the profile only fills in until they arrive.
 */
export function useRequestGuard(): RequestGuard {
  const { me } = useAuth();
  const { t } = useI18n();
  const isMember = me?.role === "MEMBER";
  const { data: mine } = useQuery({ queryKey: qk.records.mine, queryFn: apiRecords.mine, enabled: isMember });
  if (!me || !isMember) return { kind: null };

  const late = mine
    ?.filter((r) => r.status === "OVERDUE")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const hasOverdue = late ? late.length > 0 : me.hasOverdue;
  const activeLoans = mine ? mine.filter((r) => ACTIVE.includes(r.status)).length : me.activeLoans;

  if (hasOverdue) {
    const title = late?.[0]?.bookTitle;
    return {
      kind: "overdue",
      reason: title ? t("guard.overdue", { title }) : t("guard.overduePlain"),
      notice: title ? t("notice.overdue", { title }) : t("notice.overduePlain"),
    };
  }
  if (activeLoans >= me.maxBorrowLimit) {
    return {
      kind: "limit",
      reason: t("guard.limit", { limit: me.maxBorrowLimit }),
      notice: t("notice.limit", { limit: me.maxBorrowLimit }),
    };
  }
  return { kind: null };
}
