import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, RefreshCcw } from "lucide-react";
import { apiMisc, apiRecords } from "@/api";
import { invalidateCirculation, qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { activityText, actorLabel, errorMessage } from "@/lib/errors";
import { Countdown } from "@/components/Countdown";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { daysFrom, fmtDate, msLeft, timeAgo } from "@/lib/time";
import { PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { URGENT_PICKUP_MS } from "@/types";

export default function OverviewPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const deferred = useDeferredAction();
  const poll = { refetchInterval: 45_000 };
  const { data: stats, isPending } = useQuery({ queryKey: qk.stats, queryFn: apiMisc.stats, ...poll });
  const { data: activity } = useQuery({ queryKey: qk.activity, queryFn: apiMisc.activity, ...poll });
  const pendingParams = { status: "PENDING", pageSize: 1 };
  const { data: pending } = useQuery({
    queryKey: qk.records.list(pendingParams), queryFn: () => apiRecords.list(pendingParams), ...poll,
  });
  const readyParams = { status: "READY", ordering: "pickup_deadline", pageSize: 100 };
  const { data: ready } = useQuery({
    queryKey: qk.records.list(readyParams), queryFn: () => apiRecords.list(readyParams), ...poll,
  });
  const overdueParams = { status: "OVERDUE", ordering: "due_date", pageSize: 100 };
  const { data: overdue } = useQuery({
    queryKey: qk.records.list(overdueParams), queryFn: () => apiRecords.list(overdueParams), ...poll,
  });

  const runJobs = useMutation({
    mutationFn: apiMisc.runJobs,
    onSuccess: (r) => {
      if (r.cancelled + r.flaggedOverdue + r.remindersSent === 0) toast.info(t("dash.jobsNone"));
      else toast.success(t("dash.jobsDone", { c: r.cancelled, o: r.flaggedOverdue, r: r.remindersSent }));
      return invalidateCirculation(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const header = (
    <PageHeader
      title={t("staff.overview")}
      description={t("dash.runJobsHelp")}
      actions={
        <Button variant="outline" size="sm" disabled={runJobs.isPending} onClick={() => runJobs.mutate()}>
          <RefreshCcw className="size-4" aria-hidden /> {t("dash.runJobs")}
        </Button>
      }
    />
  );

  if (isPending) {
    return (
      <div className="space-y-8">
        {header}
        <div className="rounded-md border bg-white"><RowsSkeleton rows={3} /></div>
      </div>
    );
  }

  const vitals = [
    { label: t("dash.pending"), value: pending?.count, to: "/staff/approvals" },
    { label: t("dash.awaiting"), value: stats?.totalReady, to: "/staff/pickups" },
    { label: t("desk.loansNotOverdue"), value: stats?.totalBorrowed, to: "/staff/loans" },
    { label: t("dash.overdue"), value: stats?.totalOverdue, to: "/staff/loans", danger: (stats?.totalOverdue ?? 0) > 0 },
    { label: t("dash.members"), value: stats?.totalMembers, to: "/staff/users" },
    { label: t("dash.copies"), value: stats?.totalBooks, to: "/staff/inventory" },
  ];

  const urgent = (ready?.results ?? []).filter((r) => msLeft(r.pickupDeadline) < URGENT_PICKUP_MS);
  const late = overdue?.results ?? [];

  return (
    <div className="space-y-8">
      {header}

      <dl className="grid grid-cols-2 overflow-hidden rounded-md border bg-white sm:grid-cols-3 xl:grid-cols-6">
        {vitals.map((v) => (
          <Link
            key={v.label}
            to={v.to}
            className="group border-b border-e p-4 transition-colors hover:bg-surface [&:nth-child(2n)]:border-e-0 sm:[&:nth-child(2n)]:border-e sm:[&:nth-child(3n)]:border-e-0 xl:border-b-0 xl:[&:nth-child(3n)]:border-e xl:[&:nth-child(6n)]:border-e-0"
          >
            <dt className="text-sm text-muted-foreground group-hover:text-ink">{v.label}</dt>
            <dd className={cn("tabular mt-1 text-[1.75rem] font-semibold leading-none", v.danger ? "text-danger" : "text-ink")}>
              {v.value ?? "—"}
            </dd>
          </Link>
        ))}
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title={t("dash.attention")} count={urgent.length + late.length} flush>
          {urgent.length + late.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-brand" aria-hidden /> {t("dash.attentionNone")}
            </p>
          ) : (
            <ul className="divide-y">
              {late.map((r) => (
                <li key={`o${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
                  <div className="min-w-0 flex-1 basis-48">
                    <p dir="auto" className="line-clamp-2 break-words text-sm font-medium">{r.bookTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link dir="auto" to={`/staff/users/${r.userProfileId}`} className="hover:text-ink hover:underline">{r.userName}</Link>
                      {" · "}{t("req.due")} {fmtDate(r.dueDate)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-danger">{t("time.daysOverdue", { n: Math.abs(daysFrom(r.dueDate)) })}</span>
                  <DeferredRowAction kind="return" record={r} deferred={deferred} />
                </li>
              ))}
              {urgent.map((r) => (
                <li key={`r${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <Clock className="size-4 shrink-0 text-warning" aria-hidden />
                  <div className="min-w-0 flex-1 basis-48">
                    <p dir="auto" className="line-clamp-2 break-words text-sm font-medium">{r.bookTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link dir="auto" to={`/staff/users/${r.userProfileId}`} className="hover:text-ink hover:underline">{r.userName}</Link>
                      {" · "}{t("dash.closesSoon")}
                    </p>
                  </div>
                  <Countdown deadline={r.pickupDeadline!} className="tabular text-sm font-semibold text-warning" />
                  <DeferredRowAction kind="pickup" record={r} deferred={deferred} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t("dash.recent")}
          flush
          actions={<Link to="/staff/activity" className="text-sm font-medium text-brand-dark hover:underline">{t("dash.viewAll")}</Link>}
        >
          <ol className="divide-y">
            {(activity ?? []).slice(0, 7).map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p dir="auto" className="text-sm leading-snug text-ink/90">{activityText(t, a)}</p>
                <p className="mt-1 text-xs text-muted-foreground"><span dir="auto">{actorLabel(t, a.actorName)}</span> · {timeAgo(a.at)}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
