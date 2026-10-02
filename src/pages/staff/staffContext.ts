import { useState } from "react";
import { useOutletContext } from "react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";

export interface StaffContext {
  /** Re-read the sidebar queue counts after an action changes them. */
  refreshCounts: () => void;
}

export function useStaffContext(): StaffContext {
  return useOutletContext<StaffContext>() ?? { refreshCounts: () => {} };
}

/**
 * Runs a staff action: toasts the outcome, refreshes the page and the sidebar
 * counts, and reports which row is busy so its buttons can be disabled.
 */
export function useStaffAction(after: () => void) {
  const { t } = useI18n();
  const { refreshCounts } = useStaffContext();
  const [busyId, setBusyId] = useState<number | null>(null);

  const run = async (id: number, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(ok);
      after();
      refreshCounts();
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setBusyId(null);
    }
  };

  return { run, busyId };
}
