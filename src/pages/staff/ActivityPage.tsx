import { apiMisc } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { timeAgo } from "@/components/Countdown";
import { FullPageLoader } from "@/auth/guards";

export default function ActivityPage() {
  const { t } = useI18n();
  const { data: activity, loading } = useApi(() => apiMisc.activity(), [], 45_000);

  if (loading) return <FullPageLoader />;

  return (
    <div className="rounded-md border border-border bg-cream p-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
        {t("dash.recent")} · {(activity ?? []).length}
      </h2>
      <ol className="mt-3 max-h-[65vh] space-y-1.5 overflow-y-auto pe-1">
        {(activity ?? []).map((a) => (
          <li key={a.id} className="flex items-baseline gap-3 rounded-sm bg-white px-3 py-2 text-sm">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(a.at)}</span>
            <span className="shrink-0 rounded-sm bg-ink/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
              {a.action.replaceAll("_", " ")}
            </span>
            <span className="text-xs leading-relaxed">
              <span className="font-semibold">{a.actorName}</span> — {a.detail}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
