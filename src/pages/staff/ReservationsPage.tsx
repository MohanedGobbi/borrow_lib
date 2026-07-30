import { Link } from "react-router";
import { apiReservations } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { fmtDate } from "@/components/Countdown";
import { FullPageLoader } from "@/auth/guards";
import type { Reservation } from "@/types";

export default function ReservationsPage() {
  const { t } = useI18n();
  const { data: reservations, loading } = useApi(() => apiReservations.all(), [], 45_000);

  if (loading) return <FullPageLoader />;

  const byBook = new Map<string, Reservation[]>();
  (reservations ?? []).forEach((q) => {
    const list = byBook.get(q.bookTitle) ?? [];
    list.push(q);
    byBook.set(q.bookTitle, list);
  });

  return (
    <div className="rounded-md border border-border bg-cream p-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
        {t("dash.queues")} · {(reservations ?? []).length}
      </h2>
      {byBook.size === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("dash.noReservations")}</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[...byBook.entries()].map(([title, queue]) => (
            <div key={title} className="rounded-sm border border-border bg-white p-3">
              <p className="text-sm font-semibold">{title}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{queue.length} {t("dash.waiting")}</p>
              <ol className="mt-2 space-y-1">
                {queue.map((q) => (
                  <li key={q.id} className="flex items-center gap-2 text-xs">
                    <span className="flex size-4 items-center justify-center rounded-sm bg-burnt font-mono text-[9px] font-bold text-white">{q.position}</span>
                    <Link to={`/staff/users/${q.userProfileId}`} className="font-medium text-burnt hover:underline">{q.userName}</Link>
                    <span className="ms-auto font-mono text-[10px] text-muted-foreground">{fmtDate(q.reservedAt)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
