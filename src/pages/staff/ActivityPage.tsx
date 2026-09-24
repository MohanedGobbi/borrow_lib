import { apiMisc } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { fmtDateTime, timeAgo } from "@/lib/time";
import { PageHeader, Panel } from "@/components/Page";
import { FullPageLoader } from "@/auth/guards";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";

/** Turns an ACTION_CODE into readable words ("PICKUP_CONFIRMED" → "Pickup confirmed"). */
function humanize(action: string) {
  const s = action.replaceAll("_", " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ActivityPage() {
  const { t } = useI18n();
  const { data: activity, loading } = useApi(() => apiMisc.activity(), [], 45_000);

  if (loading) return <FullPageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.activity")} />
      <Panel title={t("dash.recent")} count={(activity ?? []).length} flush>
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead>
              <tr>
                <th className={tableCls.th}>{t("col.when")}</th>
                <th className={tableCls.th}>{t("col.actor")}</th>
                <th className={tableCls.th}>{t("col.event")}</th>
              </tr>
            </thead>
            <tbody>
              {(activity ?? []).map((a) => (
                <tr key={a.id} className={tableCls.row}>
                  <td className={cn(tableCls.td, "whitespace-nowrap align-top")}>
                    <span title={fmtDateTime(a.at)}>{timeAgo(a.at)}</span>
                  </td>
                  <td className={cn(tableCls.td, "whitespace-nowrap align-top font-medium")}>{a.actorName}</td>
                  <td className={cn(tableCls.td, "align-top")}>
                    <span className="me-2 inline-block rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-muted-foreground" dir="ltr">
                      {humanize(a.action)}
                    </span>
                    <span className="text-ink/90">{a.detail}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
