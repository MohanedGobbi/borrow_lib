import { Link } from "react-router";
import { Check, ClipboardCheck, X } from "lucide-react";
import { apiRecords } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { RequestDocButton } from "@/components/RequestDocButton";
import { ShowingNote } from "@/components/Pager";
import { timeAgo } from "@/lib/time";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { useStaffAction } from "@/pages/staff/staffContext";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";

export default function ApprovalsPage() {
  const { t } = useI18n();
  // oldest first: first come, first served
  const { data: result, loading, refetch } = useApi(
    () => apiRecords.list({ status: "PENDING", ordering: "requested_at", pageSize: 100 }), [], 45_000,
  );
  const { run, busyId } = useStaffAction(refetch);

  if (loading) return <FullPageLoader />;
  const pending = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.approvals")} />
      <Panel title={t("dash.pending")} count={result?.count ?? 0} flush>
        {pending.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t("dash.nothingPending")} />
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
                {pending.map((r) => (
                  <tr key={r.id} className={tableCls.row}>
                    <td className={tableCls.td}>
                      <Link to={`/staff/users/${r.userProfileId}`} className="font-medium hover:text-brand-dark hover:underline">{r.userName}</Link>
                      <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.userIdNumber}</div>
                    </td>
                    <td className={tableCls.td}>
                      <Link to={`/books/${r.bookId}`} className="hover:text-brand-dark hover:underline">{r.bookTitle}</Link>
                      <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.bookShelf}</div>
                    </td>
                    <td className={cn(tableCls.td, "whitespace-nowrap text-muted-foreground")}>{timeAgo(r.requestedAt)}</td>
                    <td className={tableCls.td}>
                      <div className="flex justify-end gap-2">
                        <RequestDocButton record={r} />
                        <Button
                          size="sm" variant="outline" disabled={busyId === r.id}
                          className="text-danger hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
                          onClick={() => run(r.id, () => apiRecords.reject(r.id), t("toast.rejected"))}
                        >
                          <X className="size-4" aria-hidden /> {t("dash.reject")}
                        </Button>
                        <Button
                          size="sm" disabled={busyId === r.id}
                          onClick={() => run(r.id, () => apiRecords.approve(r.id), t("toast.approved"))}
                        >
                          <Check className="size-4" aria-hidden /> {t("dash.approve")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ShowingNote shown={pending.length} count={result?.count ?? 0} />
      </Panel>
    </div>
  );
}
