import { toast } from "sonner";
import {
  AlertTriangle, BookCopy, BookUp2, Clock3, RefreshCcw, Users,
} from "lucide-react";
import { apiMisc } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { timeAgo } from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const { t } = useI18n();
  const { data: stats, loading, refetch } = useApi(() => apiMisc.stats(), [], 45_000);
  const { data: activity } = useApi(() => apiMisc.activity(), [], 45_000);

  if (loading) return <FullPageLoader />;

  const cards = [
    { label: t("dash.totalBooks"), value: stats?.totalBooks, icon: BookCopy, tone: "bg-ink text-white" },
    { label: t("dash.borrowed"), value: stats?.totalBorrowed, icon: BookUp2, tone: "bg-brand text-white" },
    { label: t("dash.ready"), value: stats?.totalReady, icon: Clock3, tone: "bg-warning text-white" },
    { label: t("dash.overdue"), value: stats?.totalOverdue, icon: AlertTriangle, tone: "bg-danger text-white" },
    { label: t("dash.members"), value: stats?.totalMembers, icon: Users, tone: "bg-burnt text-white" },
  ];

  const runJobs = async () => {
    try {
      const r = await apiMisc.runJobs();
      if (r.cancelled + r.flaggedOverdue === 0) toast.info("Jobs ran — nothing to change.");
      else toast.success(`Jobs: ${r.cancelled} cancelled, ${r.flaggedOverdue} flagged overdue.`);
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="border-burnt text-burnt" onClick={runJobs}>
          <RefreshCcw className="mr-1.5 size-3.5" /> {t("dash.runJobs")}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className={cn("rounded-md p-4", c.tone)}>
            <c.icon className="size-5 opacity-80" />
            <p className="mt-3 text-3xl font-bold tabular-nums">{c.value ?? "—"}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-white p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">{t("dash.recent")}</h2>
        <ol className="mt-3 space-y-1.5">
          {(activity ?? []).slice(0, 8).map((a) => (
            <li key={a.id} className="flex items-baseline gap-3 text-sm">
              <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(a.at)}</span>
              <span className="shrink-0 rounded-sm bg-ink/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                {a.action.replaceAll("_", " ")}
              </span>
              <span className="text-xs leading-relaxed">{a.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
