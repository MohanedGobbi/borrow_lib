import { useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRecords } from "@/api";
import { invalidateCirculation } from "@/api/queryKeys";
import { useLibrarySettings } from "@/hooks/useLibrarySettings";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { renewalState } from "@/lib/renewal";
import { fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BorrowRecord } from "@/types";

/**
 * Renew one BORROWED loan. The button is enabled only when the server would accept it; when it is not,
 * the reason is written next to it (a tooltip is not reachable on a phone or for a screen reader).
 * A success replaces the button with the new due date.
 */
export function RenewAction({
  record, audience, className,
}: { record: BorrowRecord; audience: "member" | "staff"; className?: string }) {
  const { t } = useI18n();
  const { rules, ready } = useLibrarySettings();
  const qc = useQueryClient();
  const [dueDate, setDueDate] = useState<string | null>(null);
  const renew = useMutation({
    mutationFn: () => apiRecords.renew(record.id),
    onSuccess: (updated) => setDueDate(updated.dueDate),
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
    // Also after a failure: the loan may have changed (renewed elsewhere, someone joined the list) since this page loaded.
    onSettled: () => invalidateCirculation(qc),
  });

  if (record.status !== "BORROWED") return null;

  if (dueDate) {
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-sm font-medium text-brand-dark", className)}>
        <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {t("renew.done", { date: fmtDate(dueDate) })}
      </p>
    );
  }

  const state = renewalState(record, rules, audience);
  const reasonId = `renew-reason-${record.id}`;
  const title = audience === "staff" ? `${record.bookTitle} · ${record.userName}` : record.bookTitle;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        size="sm" variant="outline"
        disabled={!ready || !state.ok || renew.isPending}
        aria-label={t("req.renewAria", { title })}
        aria-describedby={ready && !state.ok ? reasonId : undefined}
        onClick={() => renew.mutate()}
      >
        <RefreshCw className={cn(renew.isPending && "animate-spin")} aria-hidden /> {t("req.renew")}
      </Button>
      {ready && !state.ok && (
        <p id={reasonId} className="text-sm text-muted-foreground">
          {t(state.reason.key, state.reason.vars)}
        </p>
      )}
    </div>
  );
}
