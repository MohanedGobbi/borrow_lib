import { useState } from "react";
import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRecords } from "@/api";
import { invalidateCirculation, qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { Pager } from "@/components/Pager";
import { RequestDocButton } from "@/components/RequestDocButton";
import { daysFrom, fmtDate, msLeft } from "@/lib/time";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { useStaffAction } from "@/pages/staff/staffContext";
import { fetchPage } from "@/lib/paging";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import { DUE_SOON_MS } from "@/types";

const PAGE_SIZE = 50;

export default function LoansPage() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const params = { status: ["BORROWED", "OVERDUE"], ordering: "due_date", pageSize: PAGE_SIZE };
  const { data: result, isPending } = useQuery({
    queryKey: qk.records.list({ ...params, page }),
    queryFn: () => fetchPage((p) => apiRecords.list({ ...params, page: p }), page),
    placeholderData: keepPreviousData,
    refetchInterval: 45_000,
  });
  const { run, busyId } = useStaffAction(invalidateCirculation);

  if (isPending) return <FullPageLoader />;
  const loans = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.loans")} />
      <Panel title={t("dash.onLoan")} count={result?.count ?? 0} flush>
        {loans.length === 0 ? (
          <EmptyState icon={BookOpen} title={t("dash.noLoans")} />
        ) : (
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>{t("col.book")}</th>
                  <th className={tableCls.th}>{t("col.member")}</th>
                  <th className={tableCls.th}>{t("col.pickedUp")}</th>
                  <th className={tableCls.th}>{t("col.due")}</th>
                  <th className={tableCls.th}>{t("col.status")}</th>
                  <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((r) => {
                  const overdue = r.status === "OVERDUE";
                  const dueSoon = !overdue && msLeft(r.dueDate) < DUE_SOON_MS;
                  const days = daysFrom(r.dueDate);
                  return (
                    <tr key={r.id} className={cn(tableCls.row, overdue && "bg-danger-soft/40 hover:bg-danger-soft/60")}>
                      <td className={tableCls.td}><span className="font-medium">{r.bookTitle}</span></td>
                      <td className={tableCls.td}>
                        <Link to={`/staff/users/${r.userProfileId}`} className="hover:text-brand-dark hover:underline">{r.userName}</Link>
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap text-muted-foreground")}>{fmtDate(r.borrowedAt)}</td>
                      <td className={cn(tableCls.td, "whitespace-nowrap")}>
                        <span className={cn("font-medium", overdue && "text-danger", dueSoon && "text-warning")}>{fmtDate(r.dueDate)}</span>
                        <div className={cn("text-xs", overdue ? "text-danger" : "text-muted-foreground")}>
                          {overdue ? t("time.daysOverdue", { n: Math.abs(days) }) : days <= 1 ? t("time.dayLeft") : t("time.daysLeft", { n: days })}
                        </div>
                      </td>
                      <td className={tableCls.td}><StatusBadge status={r.status} /></td>
                      <td className={tableCls.td}>
                        <div className="flex justify-end gap-2">
                          <RequestDocButton record={r} />
                          <Button
                            size="sm" variant="outline" disabled={busyId === r.id}
                            onClick={() => run(r.id, () => apiRecords.confirmReturn(r.id), t("toast.returned"))}
                          >
                            {t("dash.confirmReturn")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {result && <Pager page={result.page} pageSize={result.pageSize} count={result.count} onPage={setPage} />}
      </Panel>
    </div>
  );
}
