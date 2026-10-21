import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, CircleSlash, Clock, PackageCheck, BookOpen, ClipboardCheck, X } from "lucide-react";
import { apiRecords } from "@/api";
import { invalidateCirculation } from "@/api/queryKeys";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { useI18n } from "@/i18n";
import { useStaffAction } from "@/pages/staff/staffContext";
import { daysFrom, fmtDate, fmtDateTime, fmtDateTimeAgo, msLeft } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { MemberStanding } from "@/components/MemberStanding";
import { RenewAction } from "@/components/RenewAction";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { RejectDialog } from "@/components/RejectDialog";
import { Button } from "@/components/ui/button";
import { URGENT_PICKUP_MS, type BorrowRecord, type Profile } from "@/types";

const OPEN = ["READY", "BORROWED", "OVERDUE", "PENDING"];

/**
 * The member workstation: who this is, whether anything blocks them, and every open hold, loan and request
 * with the action staff take on it. Used by the card-scan page and at the top of a member's record.
 * `historyHref` is a route, or a `#anchor` on the same page.
 */
export function MemberDesk({
  member, records, historyHref, actions,
}: { member: Profile; records: BorrowRecord[]; historyHref: string; actions?: ReactNode }) {
  const { t } = useI18n();
  const deferred = useDeferredAction();
  const { run, busyId } = useStaffAction(invalidateCirculation);
  const [rejecting, setRejecting] = useState<BorrowRecord | null>(null);

  const open = records.filter((r) => OPEN.includes(r.status));
  const ready = open.filter((r) => r.status === "READY").sort((a, b) => msLeft(a.pickupDeadline) - msLeft(b.pickupDeadline));
  const loans = open
    .filter((r) => r.status === "BORROWED" || r.status === "OVERDUE")
    .sort((a, b) => Number(b.status === "OVERDUE") - Number(a.status === "OVERDUE") || msLeft(a.dueDate) - msLeft(b.dueDate));
  const pending = open.filter((r) => r.status === "PENDING").sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
  const atLimit = member.active && !member.hasOverdue && member.activeLoans >= member.maxBorrowLimit;

  const rowCls = "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3";

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span dir="auto">{member.name}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <span dir="ltr" className="font-mono text-[13px]">{member.studentOrStaffId}</span>
            <span>{t(`accountType.${member.accountType}`)}</span>
            {member.role === "MEMBER" && (
              <span className="tabular">{t("desk.slots", { n: member.activeLoans, max: member.maxBorrowLimit })}</span>
            )}
            <MemberStanding member={member} />
          </span>
        }
        actions={
          <>
            {actions}
            {historyHref.startsWith("#") ? (
              <Button asChild variant="outline" size="sm"><a href={historyHref}>{t("desk.history")}</a></Button>
            ) : (
              <Button asChild variant="outline" size="sm"><Link to={historyHref}>{t("desk.history")}</Link></Button>
            )}
          </>
        }
      />

      {!member.active && (
        <Note icon={CircleSlash} tone="muted">{t("desk.inactiveBlock")}</Note>
      )}
      {member.hasOverdue && <Note icon={AlertTriangle} tone="danger">{t("desk.overdueBlock")}</Note>}
      {atLimit && <Note icon={CircleSlash} tone="muted">{t("desk.limitNote")}</Note>}

      {open.length === 0 && (
        <div className="rounded-md border bg-white"><EmptyState icon={BookOpen} title={t("scan.none")} /></div>
      )}

      {ready.length > 0 && (
        <Panel title={t("desk.readySection")} count={ready.length} flush>
          <ul className="divide-y">
            {ready.map((r) => {
              const urgent = msLeft(r.pickupDeadline) < URGENT_PICKUP_MS;
              return (
                <li key={r.id} className={rowCls}>
                  <PackageCheck className="size-4 shrink-0 text-brand" aria-hidden />
                  <BookLine record={r} />
                  <div className="text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      {urgent && <Clock className="size-3.5" aria-label={t("dash.urgent")} />}
                      <Countdown deadline={r.pickupDeadline!} className="tabular font-semibold" />
                    </span>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(r.pickupDeadline)}</div>
                  </div>
                  <DeferredRowAction kind="pickup" record={r} deferred={deferred} />
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {loans.length > 0 && (
        <Panel title={t("desk.loanSection")} count={loans.length} flush>
          <ul className="divide-y">
            {loans.map((r) => {
              const overdue = r.status === "OVERDUE";
              const days = daysFrom(r.dueDate);
              return (
                <li key={r.id} className={cn(rowCls, overdue && "bg-danger-soft/40")}>
                  {overdue
                    ? <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
                    : <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <BookLine record={r} />
                  <div className="text-sm">
                    <span className={cn("font-medium", overdue && "text-danger")}>{fmtDate(r.dueDate)}</span>
                    <div className={cn("text-xs", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                      {overdue ? t("time.daysOverdue", { n: Math.abs(days) }) : days <= 1 ? t("time.dayLeft") : t("time.daysLeft", { n: days })}
                    </div>
                  </div>
                  <RenewAction record={r} audience="staff" className="max-w-[13rem]" />
                  <DeferredRowAction kind="return" record={r} deferred={deferred} />
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {pending.length > 0 && (
        <Panel title={t("desk.pendingSection")} count={pending.length} flush>
          <ul className="divide-y">
            {pending.map((r) => {
              const vars = { title: r.bookTitle, member: r.userName };
              return (
                <li key={r.id} className={rowCls}>
                  <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <BookLine record={r} />
                  <div className="text-sm text-muted-foreground">{fmtDateTimeAgo(r.requestedAt)}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="outline" disabled={busyId === r.id || deferred.phaseOf(r.id) !== null}
                      aria-label={t("aria.reject", vars)}
                      className="text-danger hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
                      onClick={() => setRejecting(r)}
                    >
                      <X className="size-4" aria-hidden /> {t("dash.reject")}
                    </Button>
                    <DeferredRowAction kind="approve" record={r} deferred={deferred} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <RejectDialog
        record={rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        onConfirm={(r, reason) => run(r.id, () => apiRecords.reject(r.id, reason), t("toast.rejected"))}
      />
    </div>
  );
}

function BookLine({ record }: { record: BorrowRecord }) {
  return (
    <div className="min-w-[12rem] flex-1">
      <Link dir="auto" to={`/books/${record.bookId}`} className="font-medium hover:text-brand-dark hover:underline">{record.bookTitle}</Link>
      <div dir="ltr" className="whitespace-nowrap font-mono text-xs text-muted-foreground rtl:text-end">{record.bookShelf}</div>
    </div>
  );
}

function Note({
  icon: Icon, tone, children,
}: { icon: typeof AlertTriangle; tone: "danger" | "muted"; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 text-sm",
        tone === "danger" ? "border-danger/30 bg-danger-soft font-medium text-danger" : "bg-surface text-ink/85",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
