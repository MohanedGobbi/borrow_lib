import { useState } from "react";
import { Link } from "react-router";
import { Clock, PackageCheck, SearchX } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRecords } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { useI18n } from "@/i18n";
import { Countdown } from "@/components/Countdown";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { QueueFilter } from "@/components/QueueFilter";
import { fmtDateTime, msLeft } from "@/lib/time";
import { RequestDocButton } from "@/components/RequestDocButton";
import { ShowingNote } from "@/components/Pager";
import { EmptyState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { stackCls, tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import { URGENT_PICKUP_MS } from "@/types";

export default function PickupsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const search = useDebounced(filter.trim(), 300);
  const params = { status: "READY", ordering: "pickup_deadline", pageSize: 100, search };
  const { data: result, isPending } = useQuery({
    queryKey: qk.records.list(params),
    queryFn: () => apiRecords.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 45_000,
  });
  const deferred = useDeferredAction();

  const ready = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.pickups")} />
      <Panel
        title={t("dash.awaiting")} count={result?.count ?? 0} flush
        actions={<QueueFilter value={filter} onChange={setFilter} />}
      >
        {isPending ? <RowsSkeleton /> : ready.length === 0 ? (
          search
            ? <EmptyState icon={SearchX} title={t("desk.noFilterMatch", { q: search })} />
            : <EmptyState icon={PackageCheck} title={t("dash.noPickups")} />
        ) : (
          <div className={tableCls.wrap}>
            <table className={cn(tableCls.table, stackCls.table)}>
              <thead className={stackCls.head}>
                <tr>
                  <th className={tableCls.th}>{t("col.book")}</th>
                  <th className={tableCls.th}>{t("col.member")}</th>
                  <th className={tableCls.th}>{t("col.timeLeft")}</th>
                  <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {ready.map((r) => {
                  const urgent = msLeft(r.pickupDeadline) < URGENT_PICKUP_MS;
                  return (
                    <tr key={r.id} className={cn(tableCls.row, stackCls.row)}>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <span dir="auto" className="font-medium">{r.bookTitle}</span>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.bookShelf}</div>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <Link dir="auto" to={`/staff/users/${r.userProfileId}`} className="hover:text-brand-dark hover:underline">{r.userName}</Link>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.userIdNumber}</div>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <span className={"inline-flex items-center gap-1.5 text-ink"}>
                          {urgent && <Clock className="size-4" aria-label={t("dash.urgent")} />}
                          <Countdown deadline={r.pickupDeadline!} className="tabular font-semibold" />
                        </span>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(r.pickupDeadline)}</div>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <div className={cn("flex flex-wrap justify-end gap-2", stackCls.actions)}>
                          <RequestDocButton record={r} />
                          <DeferredRowAction kind="pickup" record={r} deferred={deferred} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ShowingNote shown={ready.length} count={result?.count ?? 0} />
      </Panel>
    </div>
  );
}
