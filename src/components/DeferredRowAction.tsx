import { useEffect, useRef } from "react";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import type { useDeferredAction } from "@/hooks/useDeferredAction";
import { blockReason, scheduleRowAction, type ActionRecord, type RowActionKind } from "@/lib/rowActions";
import { GuardedButton } from "@/components/GuardedButton";

type Deferred = ReturnType<typeof useDeferredAction>;

const LABEL: Record<RowActionKind, { button: string; done: string; aria: string; undo: string }> = {
  approve: { button: "dash.approve", done: "desk.approveDone", aria: "aria.approve", undo: "aria.undoApprove" },
  pickup: { button: "dash.confirmPickup", done: "desk.pickupDone", aria: "aria.confirmPickup", undo: "aria.undoPickup" },
  return: { button: "dash.confirmReturn", done: "desk.returnDone", aria: "aria.confirmReturn", undo: "aria.undoReturn" },
};

/**
 * Approve / Confirm pickup / Confirm return for one row. Clicking marks the row "Pickup confirmed · Undo" for
 * 8 seconds (see useDeferredAction); only then is the request sent. The visible text is short, the accessible
 * name says which book and member it is for.
 *
 * When the server would refuse (no free copy to hold; the member has an overdue loan, so the pickup is blocked)
 * the button stays focusable but does nothing, and says why: in a tooltip, to screen readers, and for a blocked
 * pickup also in plain text under the button, because a tooltip cannot be reached on a phone.
 */
export function DeferredRowAction({
  kind, record, deferred, focusUndo = true, short,
}: {
  kind: RowActionKind; record: ActionRecord; deferred: Deferred;
  /** Move the keyboard focus to Undo when the window opens, and back to the button after Undo. Off where the focus must stay (the desk search box). */
  focusUndo?: boolean;
  /** "Return" instead of "Confirm return", for a tight row. */
  short?: boolean;
}) {
  const { t } = useI18n();
  const ruleVars = useRuleVars();
  const phase = deferred.phaseOf(record.id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasWaiting = useRef(false);
  const vars = { title: record.bookTitle, member: record.userName };
  const label = LABEL[kind];

  // After Undo (or a failed save) the button comes back: put the keyboard focus on it again.
  useEffect(() => {
    if (phase === "waiting") wasWaiting.current = true;
    else if (phase === null && wasWaiting.current) {
      wasWaiting.current = false;
      if (focusUndo) buttonRef.current?.focus();
    }
  }, [phase, focusUndo]);

  if (phase) {
    return (
      <span role="status" className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-brand-dark">
          <CheckCircle2 className="size-4" aria-hidden /> {t(label.done)}
        </span>
        {phase === "waiting" ? (
          <>
            <span aria-hidden className="text-muted-foreground">·</span>
            <button
              type="button" autoFocus={focusUndo}
              aria-label={t(label.undo, vars)}
              className="rounded-sm font-medium text-brand-dark underline underline-offset-2 hover:text-brand"
              onClick={() => deferred.undo(record.id)}
            >
              {t("common.undo")}
            </button>
          </>
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        )}
      </span>
    );
  }

  const reason = blockReason(t, kind, record);
  const button = (
    <GuardedButton
      ref={buttonRef} size="sm" variant={kind === "return" ? "outline" : "default"} reason={reason}
      aria-label={t(label.aria, vars)}
      onClick={() => scheduleRowAction(kind, record, deferred, t, ruleVars)}
    >
      {kind === "approve" && <Check className="size-4" aria-hidden />} {t(short && kind === "return" ? "desk.returnShort" : label.button)}
    </GuardedButton>
  );

  if (reason && kind === "pickup") {
    return (
      <div className="flex flex-col items-end gap-1.5 text-end max-sm:items-start max-sm:text-start">
        {button}
        <p aria-hidden className="max-w-[16rem] text-xs font-medium text-danger">{reason}</p>
      </div>
    );
  }
  return button;
}
