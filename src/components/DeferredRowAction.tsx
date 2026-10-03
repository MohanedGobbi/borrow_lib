import { useEffect, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { apiRecords } from "@/api";
import type { useDeferredAction } from "@/hooks/useDeferredAction";
import type { BorrowRecord } from "@/types";

type Deferred = ReturnType<typeof useDeferredAction>;

/**
 * Confirm pickup / Confirm return for one row. Clicking marks the row "Pickup confirmed · Undo" for 8 seconds
 * (see useDeferredAction); only then is the request sent. The visible text is short, the accessible name says
 * which book and member it is for.
 */
export function DeferredRowAction({
  kind, record, deferred,
}: { kind: "pickup" | "return"; record: BorrowRecord; deferred: Deferred }) {
  const { t } = useI18n();
  const phase = deferred.phaseOf(record.id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasWaiting = useRef(false);
  const vars = { title: record.bookTitle, member: record.userName };

  // After Undo (or a failed save) the button comes back: put the keyboard focus on it again.
  useEffect(() => {
    if (phase === "waiting") wasWaiting.current = true;
    else if (phase === null && wasWaiting.current) {
      wasWaiting.current = false;
      buttonRef.current?.focus();
    }
  }, [phase]);

  if (phase) {
    return (
      <span role="status" className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-brand-dark">
          <CheckCircle2 className="size-4" aria-hidden /> {t(kind === "pickup" ? "desk.pickupDone" : "desk.returnDone")}
        </span>
        {phase === "waiting" ? (
          <>
            <span aria-hidden className="text-muted-foreground">·</span>
            <button
              type="button" autoFocus
              aria-label={t(kind === "pickup" ? "aria.undoPickup" : "aria.undoReturn", vars)}
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

  const pickup = kind === "pickup";
  return (
    <Button
      ref={buttonRef} size="sm" variant={pickup ? "default" : "outline"}
      aria-label={t(pickup ? "aria.confirmPickup" : "aria.confirmReturn", vars)}
      onClick={() =>
        deferred.schedule(
          record.id,
          t(pickup ? "desk.pickupToast" : "desk.returnToast", vars),
          ({ keepalive }) =>
            pickup ? apiRecords.confirmPickup(record.id, { keepalive }) : apiRecords.confirmReturn(record.id, { keepalive }),
        )
      }
    >
      {t(pickup ? "dash.confirmPickup" : "dash.confirmReturn")}
    </Button>
  );
}
