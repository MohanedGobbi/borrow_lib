import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";

/**
 * Runs a staff action as a mutation: toasts the outcome, then invalidates what the action
 * changed (lists, stock, the sidebar counts) and reports which row is busy so its buttons can
 * be disabled. The row stays busy until the refreshed list arrives, so a stale row cannot be
 * acted on twice.
 */
export function useStaffAction(invalidate: (qc: QueryClient) => Promise<unknown>) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const action = useMutation({
    mutationFn: ({ fn }: { id: number; fn: () => Promise<unknown>; ok: string }) => fn(),
    onSuccess: (_data, { ok }) => {
      toast.success(ok);
      return invalidate(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const run = (id: number, fn: () => Promise<unknown>, ok: string) => action.mutate({ id, fn, ok });
  return { run, busyId: action.isPending ? action.variables.id : null };
}
