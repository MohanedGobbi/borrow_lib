import { Link } from "react-router";
import { apiRecords, apiReservations } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown, fmtDate, timeAgo } from "@/components/Countdown";
import { RequestDocButton } from "@/components/RequestDocButton";
import { FullPageLoader } from "@/auth/guards";
import { Button } from "@/components/ui/button";

const ACTIVE = ["PENDING", "READY", "BORROWED", "OVERDUE"];

export default function MyRequestsPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const { data: records, loading, refetch } = useApi(() => apiRecords.mine(), [], 30_000);
  const { data: reservations } = useApi(() => apiReservations.mine(), []);

  if (loading || !me) return <FullPageLoader />;

  const active = (records ?? []).filter((r) => ACTIVE.includes(r.status));
  const history = (records ?? []).filter((r) => !ACTIVE.includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-burnt">{t("nav.myRequests")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{t("req.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.name} · {me.activeLoans}/{me.maxBorrowLimit} {t("req.slots")}
          {me.hasOverdue && <span className="ms-2 font-semibold text-danger">· {t("req.blocked")}</span>}
        </p>
      </div>

      {active.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("req.none")}</p>
          <Button asChild className="mt-3 bg-brand text-white hover:bg-brand-dark">
            <Link to="/catalog">{t("cart.browse")}</Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {active.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-white px-4 py-3">
            <div className="min-w-[200px] flex-1">
              <Link to={`/books/${r.bookId}`} className="text-sm font-semibold hover:text-burnt">
                {r.bookTitle}
              </Link>
              <p className="font-mono text-[11px] text-muted-foreground">
                {t("req.requested")} {timeAgo(r.requestedAt)} · {r.bookShelf}
              </p>
            </div>
            {r.status === "READY" && r.pickupDeadline && (
              <div className="text-end">
                <p className="font-mono text-[10px] uppercase tracking-widest text-warning">{t("req.pickupCloses")}</p>
                <Countdown deadline={r.pickupDeadline} />
              </div>
            )}
            {(r.status === "BORROWED" || r.status === "OVERDUE") && r.dueDate && (
              <div className="text-end">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("req.due")}</p>
                <p className={r.status === "OVERDUE" ? "font-semibold text-danger" : "text-sm"}>{fmtDate(r.dueDate)}</p>
              </div>
            )}
            <StatusBadge status={r.status} />
            <RequestDocButton record={r} />
          </div>
        ))}
      </div>

      {(reservations ?? []).length > 0 && (
        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">{t("req.reservations")}</h2>
          <div className="mt-2 divide-y divide-border rounded-md border border-border bg-white">
            {(reservations ?? []).map((q) => (
              <div key={q.id} className="flex items-center gap-4 px-4 py-2.5">
                <Link to={`/books/${q.bookId}`} className="flex-1 text-sm font-medium hover:text-burnt">{q.bookTitle}</Link>
                <span className="font-mono text-[11px] text-muted-foreground">{t("req.position")} {q.position} · {fmtDate(q.reservedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">{t("req.history")}</h2>
          <div className="mt-2 divide-y divide-border rounded-md border border-border bg-white">
            {history.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-2.5">
                <span className="flex-1 text-sm">{r.bookTitle}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {fmtDate(r.requestedAt)}{r.returnedAt ? ` → ${fmtDate(r.returnedAt)}` : ""}
                </span>
                <StatusBadge status={r.status} />
                <RequestDocButton record={r} />
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => refetch()} className="font-mono text-[11px] text-muted-foreground underline underline-offset-2 hover:text-burnt">
        {t("req.refresh")}
      </button>
    </div>
  );
}

