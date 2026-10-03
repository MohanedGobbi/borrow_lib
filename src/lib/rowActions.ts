import { apiRecords } from "@/api";
import type { useDeferredAction } from "@/hooks/useDeferredAction";
import type { BorrowRecord } from "@/types";

type Deferred = ReturnType<typeof useDeferredAction>;
type T = (key: string, vars?: Record<string, string | number>) => string;

export type RowActionKind = "approve" | "pickup" | "return";

/** What a row action needs to know about the loan. The blocking fields are optional: without them nothing blocks. */
export type ActionRecord =
  Pick<BorrowRecord, "id" | "bookTitle" | "userName">
  & Partial<Pick<BorrowRecord, "memberHasOverdue" | "memberOverdueTitle" | "bookFreeCopies">>;

/** Why the action would be refused right now (the same rules the server enforces), or undefined. */
export function blockReason(t: T, kind: RowActionKind, record: ActionRecord): string | undefined {
  if (kind === "approve" && record.bookFreeCopies !== undefined && record.bookFreeCopies <= 0) {
    return t("desk.approveBlocked");
  }
  if (kind === "pickup" && record.memberHasOverdue) {
    return record.memberOverdueTitle
      ? t("desk.pickupBlocked", { title: record.memberOverdueTitle })
      : t("desk.pickupBlockedPlain");
  }
  return undefined;
}

/**
 * Starts the 8-second Undo window for one row (the request is sent when it ends).
 * Used by the row's button and by the queue keyboard shortcuts, so both do exactly the same.
 */
export function scheduleRowAction(
  kind: RowActionKind, record: ActionRecord, deferred: Deferred, t: T, ruleVars: Record<string, string | number>,
) {
  const vars = { title: record.bookTitle, member: record.userName };
  const toast = kind === "approve" ? t("desk.approveToast", { ...vars, ...ruleVars })
    : t(kind === "pickup" ? "desk.pickupToast" : "desk.returnToast", vars);
  deferred.schedule(record.id, toast, ({ keepalive }) =>
    kind === "approve" ? apiRecords.approve(record.id, { keepalive })
      : kind === "pickup" ? apiRecords.confirmPickup(record.id, { keepalive })
        : apiRecords.confirmReturn(record.id, { keepalive }));
}
