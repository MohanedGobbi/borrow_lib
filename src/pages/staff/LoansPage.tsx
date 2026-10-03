import { useState } from "react";
import { Link } from "react-router";
import { BookOpen, SearchX } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRecords } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { useI18n } from "@/i18n";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { StatusBadge } from "@/components/StatusBadge";
import { Pager } from "@/components/Pager";
import { QueueFilter } from "@/components/QueueFilter";
import { RequestDocButton } from "@/components/RequestDocButton";
import { daysFrom, fmtDate, msLeft } from "@/lib/time";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { FullPageLoader } from "@/auth/guards";
import { fetchPage } from "@/lib/paging";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import { DUE_SOON_MS } from "@/types";

const PAGE_SIZE = 50;

export default function LoansPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const search = useDebounced(filter.trim(), 300);
  // The page belongs to one search: a new search starts again from page 1.
  const [pageState, setPageState] = useState({ key: search, page: 1 });
  const page = pageState.key === search ? pageState.page : 1;
  const params = { status: ["BORROWED", "OVERDUE"], ordering: "due_date", pageSize: PAGE_SIZE, search };
  const { data: result, isPending } = useQuery({
    queryKey: qk.records.list({ ...params, page }),
    queryFn: () => fetchPage((p) => apiRecords.list({ ...params, page: p }), page),
    placeholderData: keepPreviousData,
    refetchInterval: 45_000,
  });
  const deferred = useDeferredAction();

  if (isPending) return <FullPageLoader />;
  const loans = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.loans")} />
      <Panel
        title={t("desk.loansOut")} count={result?.count ?? 0} flush
        actions={<QueueFilter value={filter} onChange={setFilter} />}
      >
        {loans.length === 0 ? (
          search
            ? <EmptyState icon={SearchX} title={t("desk.noFilterMatch", { q: search })} />
            : <EmptyState icon={BookOpen} title={t("dash.noLoans")} />
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
                          <DeferredRowAction kind="return" record={r} deferred={deferred} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <Pager
            page={result.page} pageSize={result.pageSize} count={result.count}
            onPage={(next) => setPageState({ key: search, page: next })}
          />
        )}
      </Panel>
    </div>
  );
}
