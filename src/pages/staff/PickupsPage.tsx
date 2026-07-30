import { Link } from "react-router";
import { toast } from "sonner";
import { apiRecords } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { Countdown, msLeft } from "@/components/Countdown";
import { RequestDocButton } from "@/components/RequestDocButton";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { cn } from "@/lib/utils";
import { URGENT_PICKUP_MS } from "@/types";

export default function PickupsPage() {
  const { t } = useI18n();
  const { data: records, loading, refetch } = useApi(() => apiRecords.list({ status: "READY" }), [], 45_000);

  if (loading) return <FullPageLoader />;
  const ready = (records ?? []).sort((a, b) => msLeft(a.pickupDeadline) - msLeft(b.pickupDeadline));

  const confirm = async (id: number) => {
    try {
      await apiRecords.confirmPickup(id);
      toast.success("Pickup confirmed — 14-day loan started.");
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed.");
    }
  };

  return (
    <div className="rounded-md border border-border bg-cream p-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
        {t("dash.awaiting")} · {ready.length}
      </h2>
      {ready.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("dash.noPickups")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {ready.map((r) => {
            const urgent = msLeft(r.pickupDeadline) < URGENT_PICKUP_MS;
            return (
              <div key={r.id} className={cn(
                "flex flex-wrap items-center gap-3 rounded-sm border px-3 py-2.5",
                urgent ? "border-warning bg-warning/10" : "border-border bg-white"
              )}>
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-semibold">{r.bookTitle}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    <Link to={`/staff/users/${r.userProfileId}`} className="text-burnt hover:underline">{r.userName}</Link>
                    {" · "}{r.bookShelf}
                  </p>
                </div>
                {urgent && (
                  <span className="rounded-sm bg-danger px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    {t("dash.urgent")}
                  </span>
                )}
                <div className="text-end">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("dash.timeLeft")}</p>
                  <Countdown deadline={r.pickupDeadline!} />
                </div>
                <RequestDocButton record={r} />
                <Button size="sm" className="bg-brand text-white hover:bg-brand-dark" onClick={() => confirm(r.id)}>
                  {t("dash.confirmPickup")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
