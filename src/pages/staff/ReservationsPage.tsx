import { Link } from "react-router";
import { ListOrdered } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiReservations } from "@/api";
import { qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { fmtDate } from "@/lib/time";
import { EmptyState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import type { Reservation } from "@/types";

export default function ReservationsPage() {
  const { t } = useI18n();
  const { data: reservations, isPending } = useQuery({
    queryKey: qk.reservations.list, queryFn: apiReservations.all, refetchInterval: 45_000,
  });


  const byBook = new Map<number, Reservation[]>();
  (reservations ?? []).forEach((q) => byBook.set(q.bookId, [...(byBook.get(q.bookId) ?? []), q]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.reservations")} />
      {isPending ? (
        <div className="rounded-md border bg-white"><RowsSkeleton /></div>
      ) : byBook.size === 0 ? (
        <div className="rounded-md border bg-white"><EmptyState icon={ListOrdered} title={t("dash.noReservations")} /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {[...byBook.entries()].map(([bookId, queue]) => (
            <Panel
              key={bookId}
              title={<Link dir="auto" to={`/books/${bookId}`} className="hover:text-brand-dark hover:underline">{queue[0].bookTitle}</Link>}
              count={queue.length}
              flush
            >
              <ol className="divide-y">
                {queue.map((q) => (
                  <li key={q.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold">{q.position}</span>
                    <Link dir="auto" to={`/staff/users/${q.userProfileId}`} className="flex-1 font-medium hover:text-brand-dark hover:underline">{q.userName}</Link>
                    <span className="text-muted-foreground">{fmtDate(q.reservedAt)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
