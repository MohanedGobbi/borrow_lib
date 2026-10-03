import { useState } from "react";
import { Link } from "react-router";
import { Ban, Check, ClipboardCheck, SearchX, X } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRecords } from "@/api";
import { invalidateCirculation, qk } from "@/api/queryKeys";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { GuardedButton } from "@/components/GuardedButton";
import { RecordStanding } from "@/components/MemberStanding";
import { QueueFilter } from "@/components/QueueFilter";
import { RejectDialog } from "@/components/RejectDialog";
import { RequestDocButton } from "@/components/RequestDocButton";
import { ShowingNote } from "@/components/Pager";
import { fmtDateTimeAgo } from "@/lib/time";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { useStaffAction } from "@/pages/staff/staffContext";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import type { BorrowRecord } from "@/types";

export default function ApprovalsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const search = useDebounced(filter.trim(), 300);
  // oldest first: first come, first served
  const params = { status: "PENDING", ordering: "requested_at", pageSize: 100, search };
  const { data: result, isPending } = useQuery({
    queryKey: qk.records.list(params),
    queryFn: () => apiRecords.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 45_000,
  });
  const { run, busyId } = useStaffAction(invalidateCirculation);
  const [rejecting, setRejecting] = useState<BorrowRecord | null>(null);

  if (isPending) return <FullPageLoader />;
  const pending = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.approvals")} />
      <Panel
        title={t("desk.awaitingDecision")} count={result?.count ?? 0} flush
        actions={<QueueFilter value={filter} onChange={setFilter} />}
      >
        {pending.length === 0 ? (
          search
            ? <EmptyState icon={SearchX} title={t("desk.noFilterMatch", { q: search })} />
            : <EmptyState icon={ClipboardCheck} title={t("dash.nothingPending")} />
        ) : (
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>{t("col.member")}</th>
                  <th className={tableCls.th}>{t("col.book")}</th>
                  <th className={tableCls.th}>{t("col.requested")}</th>
                  <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => {
                  const noCopy = r.bookFreeCopies <= 0;
                  const vars = { title: r.bookTitle, member: r.userName };
                  return (
                    <tr key={r.id} className={tableCls.row}>
                      <td className={tableCls.td}>
                        <Link to={`/staff/users/${r.userProfileId}`} className="font-medium hover:text-brand-dark hover:underline">{r.userName}</Link>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.userIdNumber}</div>
                        <RecordStanding record={r} />
                      </td>
                      <td className={tableCls.td}>
                        <Link to={`/books/${r.bookId}`} className="hover:text-brand-dark hover:underline">{r.bookTitle}</Link>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span dir="ltr" className="whitespace-nowrap font-mono">{r.bookShelf}</span>
                          <span aria-hidden>·</span>
                          {noCopy ? (
                            <span className="inline-flex items-center gap-1 font-medium text-ink/80">
                              <Ban className="size-3.5" aria-hidden /> {t("desk.noFree")}
                            </span>
                          ) : (
                            <span className="tabular">{t("desk.free", { n: r.bookFreeCopies })}</span>
                          )}
                        </div>
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap text-muted-foreground")}>{fmtDateTimeAgo(r.requestedAt)}</td>
                      <td className={tableCls.td}>
                        <div className="flex justify-end gap-2">
                          <RequestDocButton record={r} />
                          <Button
                            size="sm" variant="outline" disabled={busyId === r.id}
                            aria-label={t("aria.reject", vars)}
                            className="text-danger hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
                            onClick={() => setRejecting(r)}
                          >
                            <X className="size-4" aria-hidden /> {t("dash.reject")}
                          </Button>
                          <GuardedButton
                            size="sm" disabled={busyId === r.id}
                            aria-label={t("aria.approve", vars)}
                            reason={noCopy ? t("desk.approveBlocked") : undefined}
                            onClick={() => run(r.id, () => apiRecords.approve(r.id), t("toast.approved"))}
                          >
                            <Check className="size-4" aria-hidden /> {t("dash.approve")}
                          </GuardedButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ShowingNote shown={pending.length} count={result?.count ?? 0} />
      </Panel>

      <RejectDialog
        record={rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        onConfirm={(r, reason) => run(r.id, () => apiRecords.reject(r.id, reason), t("toast.rejected"))}
      />
    </div>
  );
}
