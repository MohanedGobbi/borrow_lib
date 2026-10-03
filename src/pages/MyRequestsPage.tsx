import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ArrowRight, BookOpen, QrCode } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRecords, apiReservations } from "@/api";
import { invalidateCirculation, qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { StatusBadge } from "@/components/StatusBadge";
import { WithdrawDialog, type WithdrawTarget } from "@/components/WithdrawDialog";
import { Countdown } from "@/components/Countdown";
import { daysFrom, fmtDate, fmtDateTime } from "@/lib/time";
import { RenewAction } from "@/components/RenewAction";
import { RequestDocButton } from "@/components/RequestDocButton";
import { Container } from "@/components/Layout";
import { EmptyState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { FullPageLoader } from "@/auth/guards";
import { Button } from "@/components/ui/button";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import type { BorrowRecord } from "@/types";

const ACTIVE = ["OVERDUE", "READY", "BORROWED", "PENDING"];

/** When the date that matters for this record falls, as a sortable number (earlier = more urgent). */
function urgency(r: BorrowRecord) {
  const date = r.status === "READY" ? r.pickupDeadline : r.status === "PENDING" ? r.requestedAt : r.dueDate;
  return date ? Date.parse(date) : Infinity;
}

export default function MyRequestsPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const { data: records, isPending } = useQuery({
    queryKey: qk.records.mine, queryFn: apiRecords.mine, refetchInterval: 30_000,
  });
  const { data: reservations } = useQuery({ queryKey: qk.reservations.mine, queryFn: apiReservations.mine });
  const qc = useQueryClient();
  const [target, setTarget] = useState<WithdrawTarget | null>(null);

  // Giving up a request, a hold or a place in line changes free copies and queues everywhere.
  const withdraw = useMutation({
    mutationFn: async (what: WithdrawTarget) => {
      if (what.kind === "waitlist") await apiReservations.leave(what.id);
      else await apiRecords.withdraw(what.id);
    },
    onSuccess: (_data, what) => {
      toast.success(t(what.kind === "request" ? "toast.withdrawn" : what.kind === "hold" ? "toast.holdReleased" : "toast.leftList"));
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
    // Also after a failure: the row may have moved on (approved, picked up) since this page loaded.
    onSettled: () => invalidateCirculation(qc),
  });

  if (!me) return <FullPageLoader />;

  // most urgent first: overdue, ready for pickup, on loan, pending
  // and within a state, the date that is closest first: the hold that closes soonest, the loan due soonest
  const active = (records ?? [])
    .filter((r) => ACTIVE.includes(r.status))
    .sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status) || urgency(a) - urgency(b));
  const history = (records ?? []).filter((r) => !ACTIVE.includes(r.status));

  return (
    <Container>
      <PageHeader
        title={t("req.title")}
        description={
          <span>
            <bdi dir="ltr" className="tabular font-medium text-ink">{me.activeLoans} / {me.maxBorrowLimit}</bdi> {t("req.slots")}
          </span>
        }
      />

      {me.hasOverdue && (
        <div role="alert" className="mt-6 flex gap-3 rounded-md border border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-semibold text-danger">{t("req.blockedTitle")}</p>
            <p className="mt-0.5 text-sm text-ink/80">{t("req.blockedBody")}</p>
          </div>
        </div>
      )}

      <section className="mt-8" aria-labelledby="active-h">
        <h2 id="active-h" className="text-[15px] font-semibold text-ink">{t("req.active")}</h2>
        {isPending ? (
          <div className="mt-3 rounded-md border bg-white"><RowsSkeleton rows={3} /></div>
        ) : active.length === 0 ? (
          <div className="mt-3 rounded-md border">
            <EmptyState icon={BookOpen} title={t("req.none")}>
              <Button asChild size="sm"><Link to="/catalog">{t("cart.browse")}</Link></Button>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-3 divide-y overflow-hidden rounded-md border bg-white">
            {active.map((r, i) => (
              <ActiveRow
                key={r.id} r={r} lead={i === 0}
                onWithdraw={(kind) => setTarget({ kind, id: r.id, title: r.bookTitle })}
              />
            ))}
          </ul>
        )}
      </section>

      {(reservations ?? []).length > 0 && (
        <Panel className="mt-8" title={t("req.reservations")} count={(reservations ?? []).length} flush>
          <ul className="divide-y">
            {(reservations ?? []).map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <Link to={`/books/${q.bookId}`} dir="auto" className="flex-1 font-medium hover:text-brand-dark hover:underline">{q.bookTitle}</Link>
                <span className="text-sm text-muted-foreground">
                  {t("req.position")} <span className="tabular font-semibold text-ink">{q.position}</span> · {fmtDate(q.reservedAt)}
                </span>
                <Button
                  size="sm" variant="outline" disabled={withdraw.isPending}
                  onClick={() => setTarget({ kind: "waitlist", id: q.id, title: q.bookTitle })}
                >
                  {t("req.leaveList")}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {history.length > 0 && (
        <Panel className="mt-8" title={t("req.history")} count={history.length} flush>
          {/* phones: stacked rows; wider screens: table */}
          <ul className="divide-y sm:hidden">
            {history.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <Link to={`/books/${r.bookId}`} dir="auto" className="font-medium hover:text-brand-dark hover:underline">{r.bookTitle}</Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                  <StatusBadge status={r.status} />
                  <span className="inline-flex items-center gap-1.5">
                    {fmtDate(r.requestedAt)}
                    {r.returnedAt && (
                      <>
                        <ArrowRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />
                        {fmtDate(r.returnedAt)}
                      </>
                    )}
                  </span>
                </div>
                <RejectionReason record={r} />
                <CancelledNote record={r} />
                <div className="mt-1 -ms-3"><RequestDocButton record={r} /></div>
              </li>
            ))}
          </ul>
          <div className={cn(tableCls.wrap, "hidden sm:block")}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>{t("col.book")}</th>
                  <th className={tableCls.th}>{t("col.requested")}</th>
                  <th className={tableCls.th}>{t("req.returned")}</th>
                  <th className={tableCls.th}>{t("col.status")}</th>
                  <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className={tableCls.row}>
                    <td className={tableCls.td}>
                      <Link to={`/books/${r.bookId}`} dir="auto" className="font-medium hover:text-brand-dark hover:underline">{r.bookTitle}</Link>
                      <RejectionReason record={r} />
                      <CancelledNote record={r} />
                    </td>
                    <td className={tableCls.td}>{fmtDate(r.requestedAt)}</td>
                    <td className={tableCls.td}>{fmtDate(r.returnedAt)}</td>
                    <td className={tableCls.td}><StatusBadge status={r.status} /></td>
                    <td className={cn(tableCls.td, "text-end")}><RequestDocButton record={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <WithdrawDialog target={target} onOpenChange={(open) => !open && setTarget(null)} onConfirm={(what) => withdraw.mutate(what)} />
    </Container>
  );
}

/**
 * One current request/loan, with the date that matters most for its state set large in the serif face.
 * The first row of the list (the most urgent) is the lead: more room, a bigger title and figure, a faint ground.
 */
function ActiveRow({ r, lead, onWithdraw }: { r: BorrowRecord; lead: boolean; onWithdraw: (kind: "request" | "hold") => void }) {
  const { t } = useI18n();
  const overdue = r.status === "OVERDUE";
  const days = daysFrom(r.dueDate);
  const fig = cn("tabular font-display font-semibold leading-none", lead ? "text-[2.25rem] font-medium tracking-[-0.01em] sm:whitespace-nowrap" : "text-[1.375rem]");

  let keyLabel: string;
  let keyValue: React.ReactNode;
  if (r.status === "READY" && r.pickupDeadline) {
    keyLabel = `${t("req.pickupBy")} ${fmtDateTime(r.pickupDeadline)}`;
    keyValue = <Countdown deadline={r.pickupDeadline} className={cn(fig, "text-brand-dark")} />;
  } else if (overdue) {
    keyLabel = `${t("req.overdue")} ${fmtDate(r.dueDate)}`;
    keyValue = <span className={cn(fig, "text-danger")}>{t("time.daysOverdue", { n: Math.abs(days) })}</span>;
  } else if (r.status === "BORROWED") {
    keyLabel = `${t("req.due")} ${fmtDate(r.dueDate)}`;
    keyValue = <span className={cn(fig, "text-ink")}>{days <= 1 ? t("time.dayLeft") : t("time.daysLeft", { n: days })}</span>;
  } else {
    keyLabel = `${t("req.requested")} ${fmtDate(r.requestedAt)}`;
    keyValue = <span className="text-[15px] text-muted-foreground">{t("req.waiting")}</span>;
  }

  return (
    <li
      className={cn(
        "grid gap-x-8 gap-y-4 p-4 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-center",
        lead && "p-5 sm:p-7",
        overdue ? "bg-danger-soft/50" : lead && (r.status === "READY" ? "bg-brand-soft/50" : "bg-surface/70"),
      )}
    >
      <div className="min-w-0">
        <Link
          to={`/books/${r.bookId}`} dir="auto"
          className={cn("text-ink hover:text-brand-dark hover:underline", lead ? "type-feature" : "font-semibold")}
        >
          {r.bookTitle}
        </Link>
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground", lead ? "mt-3" : "mt-1.5")}>
          <StatusBadge status={r.status} />
          <span>{t("field.shelf")} <span dir="ltr" className="font-mono text-[13px] text-ink/80">{r.bookShelf || "—"}</span></span>
        </div>
        {r.status === "READY" && r.memberHasOverdue && (
          // An overdue loan also blocks the pickup: say so under the hold, before they come to the desk.
          <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{r.memberOverdueTitle ? t("req.holdBlocked", { title: r.memberOverdueTitle }) : t("req.holdBlockedPlain")}</span>
          </p>
        )}
      </div>
      <div>
        <div>{keyValue}</div>
        <div className={cn("text-sm text-muted-foreground", lead ? "mt-2.5" : "mt-1")}>{keyLabel}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:justify-end">
        {r.status === "PENDING" && (
          <Button size="sm" variant="outline" onClick={() => onWithdraw("request")}>{t("req.cancelRequest")}</Button>
        )}
        {r.status === "READY" && (
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/profile#card"><QrCode aria-hidden /> {t("req.showCard")}</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => onWithdraw("hold")}>{t("req.releaseHold")}</Button>
          </>
        )}
        {r.status === "BORROWED" && <RenewAction record={r} audience="member" className="items-start sm:items-end sm:text-end" />}
        <RequestDocButton record={r} />
      </div>
    </li>
  );
}

/** Why staff rejected a request, when they said. */
function RejectionReason({ record }: { record: BorrowRecord }) {
  const { t } = useI18n();
  if (record.status !== "REJECTED" || !record.rejectionReason) return null;
  return (
    <p className="mt-1.5 max-w-prose text-sm text-ink/85">
      <span className="font-medium">{t("req.rejectedReason")}:</span>{" "}
      <span dir="auto">{record.rejectionReason}</span>
    </p>
  );
}

/** Tells a withdrawn request apart from one that expired or staff turned down. */
function CancelledNote({ record }: { record: BorrowRecord }) {
  const { t } = useI18n();
  if (record.status !== "CANCELLED" || !record.cancelledByMember) return null;
  return <p className="mt-1.5 text-sm text-muted-foreground">{t("req.cancelledByYou")}</p>;
}
