import { useState } from "react";
import { Link } from "react-router";
import { BookOpen, Clock, Download, SearchX } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRecords } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { useI18n } from "@/i18n";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { LoansExportDialog } from "@/components/ExportControls";
import { StatusBadge } from "@/components/StatusBadge";
import { Pager } from "@/components/Pager";
import { QueueFilter } from "@/components/QueueFilter";
import { RenewAction } from "@/components/RenewAction";
import { RowMenu } from "@/components/RowMenu";
import { daysFrom, fmtDate, hourCutoff, msLeft } from "@/lib/time";
import { EmptyState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { fetchPage } from "@/lib/paging";
import { stackCls, tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import { DUE_SOON_DAYS, DUE_SOON_MS } from "@/types";

const PAGE_SIZE = 50;

type LoanFilter = "all" | "overdue" | "due";

export default function LoansPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const [segment, setSegment] = useState<LoanFilter>("all");
  const search = useDebounced(filter.trim(), 300);
  // The page belongs to one search and segment: changing either starts again from page 1.
  const pageKey = `${segment}|${search}`;
  const [pageState, setPageState] = useState({ key: pageKey, page: 1 });
  const page = pageState.key === pageKey ? pageState.page : 1;
  // "Due within 3 days" is a server filter; the cut-off moves on the hour.
  const dueBefore = hourCutoff(DUE_SOON_MS);
  const segments = {
    all: { status: ["BORROWED", "OVERDUE"] },
    overdue: { status: "OVERDUE" },
    due: { status: "BORROWED", dueBefore },
  } satisfies Record<LoanFilter, { status: string | string[]; dueBefore?: string }>;
  const params = { ...segments[segment], ordering: "due_date", pageSize: PAGE_SIZE, search };
  const { data: result, isPending } = useQuery({
    queryKey: qk.records.list({ ...params, page }),
    queryFn: () => fetchPage((p) => apiRecords.list({ ...params, page: p }), page),
    placeholderData: keepPreviousData,
    refetchInterval: 45_000,
  });
  // The counts on the filter ignore the search box: they say how much of each there is in the library.
  const overdueCountParams = { ...segments.overdue, pageSize: 1 };
  const { data: overdueCount } = useQuery({
    queryKey: qk.records.list(overdueCountParams), queryFn: () => apiRecords.list(overdueCountParams), refetchInterval: 45_000,
  });
  const dueCountParams = { ...segments.due, pageSize: 1 };
  const { data: dueCount } = useQuery({
    queryKey: qk.records.list(dueCountParams), queryFn: () => apiRecords.list(dueCountParams), refetchInterval: 45_000,
  });
  const deferred = useDeferredAction();
  const [exporting, setExporting] = useState(false);

  const loans = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("staff.loans")}
        actions={
          <Button size="sm" variant="outline" onClick={() => setExporting(true)}>
            <Download className="size-4" aria-hidden /> {t("export.button")}
          </Button>
        }
      />
      <LoansExportDialog open={exporting} onOpenChange={setExporting} />
      <Panel
        title={t("desk.loansOut")} count={result?.count ?? 0} flush
        actions={<QueueFilter value={filter} onChange={setFilter} />}
      >
        <div role="group" aria-label={t("loans.filterLabel")} className="flex flex-wrap gap-1 border-b px-4 py-2.5">
          {([
            ["all", t("loans.filterAll")],
            ["overdue", t("loans.filterOverdue", { n: overdueCount?.count ?? "…" })],
            ["due", t("loans.filterDue", { n: dueCount?.count ?? "…", days: DUE_SOON_DAYS })],
          ] as [LoanFilter, string][]).map(([key, label]) => (
            <button
              key={key} type="button" aria-pressed={segment === key}
              onClick={() => setSegment(key)}
              className={cn(
                "tabular rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                segment === key ? "bg-brand-soft text-brand-dark" : "text-muted-foreground hover:bg-surface hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {isPending ? <RowsSkeleton /> : loans.length === 0 ? (
          search
            ? <EmptyState icon={SearchX} title={t("desk.noFilterMatch", { q: search })} />
            : segment === "overdue" ? <EmptyState icon={BookOpen} title={t("loans.noneOverdue")} />
              : segment === "due" ? <EmptyState icon={BookOpen} title={t("loans.noneDue", { days: DUE_SOON_DAYS })} />
                : <EmptyState icon={BookOpen} title={t("dash.noLoans")} />
        ) : (
          <div className={tableCls.wrap}>
            <table className={cn(tableCls.table, stackCls.table)}>
              <thead className={stackCls.head}>
                <tr>
                  <th className={tableCls.th}>{t("col.book")}</th>
                  <th className={tableCls.th}>{t("col.member")}</th>
                  <th className={cn(tableCls.th, "max-sm:hidden")}>{t("col.pickedUp")}</th>
                  <th className={tableCls.th}>{t("col.due")}</th>
                  <th className={tableCls.th}>{t("col.status")}</th>
                  <th className={tableCls.th}>{t("col.renewal")}</th>
                  <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((r) => {
                  const overdue = r.status === "OVERDUE";
                  const dueSoon = !overdue && msLeft(r.dueDate) < DUE_SOON_MS;
                  const days = daysFrom(r.dueDate);
                  return (
                    <tr key={r.id} className={cn(tableCls.row, stackCls.row, overdue && "bg-danger-soft/40 hover:bg-danger-soft/60")}>
                      <td className={cn(tableCls.td, stackCls.cell)}><span dir="auto" className="font-medium">{r.bookTitle}</span></td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <Link dir="auto" to={`/staff/users/${r.userProfileId}`} className="hover:text-brand-dark hover:underline">{r.userName}</Link>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell, "whitespace-nowrap text-muted-foreground max-sm:hidden")}>{fmtDate(r.borrowedAt)}</td>
                      <td className={cn(tableCls.td, stackCls.cell, "whitespace-nowrap")}>
                        <span className={cn("font-medium", overdue && "text-danger")}>{fmtDate(r.dueDate)}</span>
                        <div className={cn("flex items-center gap-1 text-xs", overdue ? "text-danger" : dueSoon ? "font-medium text-ink" : "text-muted-foreground")}>
                          {dueSoon && <Clock className="size-3.5 shrink-0" aria-hidden />}
                          {overdue ? t("time.daysOverdue", { n: Math.abs(days) }) : days <= 1 ? t("time.dayLeft") : t("time.daysLeft", { n: days })}
                        </div>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}><StatusBadge status={r.status} /></td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <RenewAction record={r} audience="staff" quiet className="items-start" />
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <div className={cn("flex items-center justify-end gap-2 max-sm:flex-wrap", stackCls.actions)}>
                          <DeferredRowAction kind="return" record={r} deferred={deferred} />
                          <RowMenu record={r} />
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
            onPage={(next) => setPageState({ key: pageKey, page: next })}
          />
        )}
      </Panel>
    </div>
  );
}
