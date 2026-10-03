import { useQuery } from "@tanstack/react-query";
import { apiMisc } from "@/api";
import { qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { activityText, actorLabel } from "@/lib/errors";
import { fmtDateTime, timeAgo } from "@/lib/time";
import { PageHeader, Panel } from "@/components/Page";
import { FullPageLoader } from "@/auth/guards";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";

export default function ActivityPage() {
  const { t } = useI18n();
  const { data: activity, isPending } = useQuery({
    queryKey: qk.activity, queryFn: apiMisc.activity, refetchInterval: 45_000,
  });

  if (isPending) return <FullPageLoader />;

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
                  <td className={cn(tableCls.td, "whitespace-nowrap align-top font-medium")}><span dir="auto">{actorLabel(t, a.actorName)}</span></td>
                  <td className={cn(tableCls.td, "align-top")}>
                    <span dir="auto" className="text-ink/90">{activityText(t, a)}</span>
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
