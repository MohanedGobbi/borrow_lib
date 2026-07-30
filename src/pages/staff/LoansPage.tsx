import { Link } from "react-router";
import { toast } from "sonner";
import { apiRecords } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { RequestDocButton } from "@/components/RequestDocButton";
import { fmtDate, msLeft } from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { cn } from "@/lib/utils";
import { DUE_SOON_MS } from "@/types";

export default function LoansPage() {
  const { t } = useI18n();
  const { data: records, loading, refetch } = useApi(() => apiRecords.list(), [], 45_000);

  if (loading) return <FullPageLoader />;
  const loans = (records ?? [])
    .filter((r) => r.status === "BORROWED" || r.status === "OVERDUE")
    .sort((a, b) => msLeft(a.dueDate) - msLeft(b.dueDate));

  const confirmReturn = async (id: number) => {
    try {
      await apiRecords.confirmReturn(id);
      toast.success("Return confirmed — copy back on the shelf.");
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed.");
    }
  };

  return (
    <div className="rounded-md border border-border bg-cream p-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
        {t("dash.activeLoans")} · {loans.length}
      </h2>
      {loans.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("dash.noLoans")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {loans.map((r) => {
            const overdue = r.status === "OVERDUE";
            const dueSoon = !overdue && msLeft(r.dueDate) < DUE_SOON_MS;
            return (
              <div key={r.id} className={cn(
                "flex flex-wrap items-center gap-3 rounded-sm border px-3 py-2.5",
                overdue ? "border-danger bg-danger/10" : dueSoon ? "border-warning bg-warning/10" : "border-border bg-white"
              )}>
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-semibold">{r.bookTitle}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    <Link to={`/staff/users/${r.userProfileId}`} className="text-burnt hover:underline">{r.userName}</Link>
                    {" · "}{t("book.pickedUp")} {fmtDate(r.borrowedAt)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("req.due")}</p>
                  <p className={cn("text-sm font-medium tabular-nums", overdue && "text-danger", dueSoon && "text-warning")}>
                    {fmtDate(r.dueDate)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
                <RequestDocButton record={r} />
                <Button size="sm" variant="outline" className="border-success text-success hover:bg-success hover:text-white"
                  onClick={() => confirmReturn(r.id)}>
                  {t("dash.confirmReturn")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
