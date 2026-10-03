import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Clock, PackageCheck, SearchX } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRecords } from "@/api";
import { qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { useQueueKeys } from "@/hooks/useQueueKeys";
import { blockReason, scheduleRowAction } from "@/lib/rowActions";
import { RecordStanding } from "@/components/MemberStanding";
import { useI18n } from "@/i18n";
import { Countdown } from "@/components/Countdown";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { QueueFilter } from "@/components/QueueFilter";
import { fmtDateTime, msLeft } from "@/lib/time";
import { RowMenu } from "@/components/RowMenu";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { ShowingNote } from "@/components/Pager";
import { EmptyState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { KeyHint } from "@/components/KeyHint";
import { stackCls, tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import { URGENT_PICKUP_MS } from "@/types";

export default function PickupsPage() {
  const { t } = useI18n();
  const ruleVars = useRuleVars();
  const navigate = useNavigate();
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

  const keys = useQueueKeys({
    rows: ready,
    onOpen: (r) => navigate(`/staff/users/${r.userProfileId}`),
    onKey: (key, r) => {
      if (key !== "p") return false;
      if (deferred.phaseOf(r.id)) return true; // already confirmed, in its Undo window
      const reason = blockReason(t, "pickup", r);
      if (reason) toast.error(reason);
      else scheduleRowAction("pickup", r, deferred, t, ruleVars);
      return true;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.pickups")} />
      <Panel
        title={t("dash.awaiting")} count={result?.count ?? 0} flush headingRef={keys.headingRef}
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
              <tbody {...keys.bodyProps}>
                {ready.map((r) => {
                  const urgent = msLeft(r.pickupDeadline) < URGENT_PICKUP_MS;
                  return (
                    <tr key={r.id} {...keys.rowProps(r.id)} className={cn(tableCls.row, stackCls.row, tableCls.keyRow)}>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <span dir="auto" className="font-medium">{r.bookTitle}</span>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.bookShelf}</div>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <Link dir="auto" to={`/staff/users/${r.userProfileId}`} className="hover:text-brand-dark hover:underline">{r.userName}</Link>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.userIdNumber}</div>
                        <RecordStanding record={r} pickup />
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <span className={"inline-flex items-center gap-1.5 text-ink"}>
                          {urgent && <Clock className="size-4" aria-label={t("dash.urgent")} />}
                          <Countdown deadline={r.pickupDeadline!} className="tabular font-semibold" />
                        </span>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(r.pickupDeadline)}</div>
                      </td>
                      <td className={cn(tableCls.td, stackCls.cell)}>
                        <div className={cn("flex items-center justify-end gap-2 max-sm:flex-wrap", stackCls.actions)}>
                          <DeferredRowAction kind="pickup" record={r} deferred={deferred} />
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
        <ShowingNote shown={ready.length} count={result?.count ?? 0} />
      </Panel>
      <KeyHint text={t("keys.pickups")} />
    </div>
  );
}
