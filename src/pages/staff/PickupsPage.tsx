import { Link } from "react-router";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { apiRecords } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { Countdown } from "@/components/Countdown";
import { fmtDateTime, msLeft } from "@/lib/time";
import { RequestDocButton } from "@/components/RequestDocButton";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { useStaffAction } from "@/pages/staff/staffContext";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import { URGENT_PICKUP_MS } from "@/types";

export default function PickupsPage() {
  const { t } = useI18n();
  const { data: records, loading, refetch } = useApi(() => apiRecords.list({ status: "READY" }), [], 45_000);
  const { run, busyId } = useStaffAction(refetch);

  if (loading) return <FullPageLoader />;
  const ready = [...(records ?? [])].sort((a, b) => msLeft(a.pickupDeadline) - msLeft(b.pickupDeadline));

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.pickups")} />
      <Panel title={t("dash.awaiting")} count={ready.length} flush>
        {ready.length === 0 ? (
          <EmptyState icon={PackageCheck} title={t("dash.noPickups")} />
        ) : (
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead>
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
                    <tr key={r.id} className={tableCls.row}>
                      <td className={tableCls.td}>
                        <span className="font-medium">{r.bookTitle}</span>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.bookShelf}</div>
                      </td>
                      <td className={tableCls.td}>
                        <Link to={`/staff/users/${r.userProfileId}`} className="hover:text-brand-dark hover:underline">{r.userName}</Link>
                        <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{r.userIdNumber}</div>
                      </td>
                      <td className={tableCls.td}>
                        <span className={cn("inline-flex items-center gap-1.5", urgent ? "text-warning" : "text-ink")}>
                          {urgent && <AlertTriangle className="size-4" aria-label={t("dash.urgent")} />}
                          <Countdown deadline={r.pickupDeadline!} className="tabular font-semibold" />
                        </span>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(r.pickupDeadline)}</div>
                      </td>
                      <td className={tableCls.td}>
                        <div className="flex justify-end gap-2">
                          <RequestDocButton record={r} />
                          <Button
                            size="sm" disabled={busyId === r.id}
                            onClick={() => run(r.id, () => apiRecords.confirmPickup(r.id), t("toast.pickedUp"))}
                          >
                            {t("dash.confirmPickup")}
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
      </Panel>
    </div>
  );
}
