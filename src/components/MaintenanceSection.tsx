import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookX, DatabaseBackup, Download, Eraser, History, RefreshCw, RotateCcw, Upload, UserX, type LucideIcon,
} from "lucide-react";
import { apiMaintenance, apiMisc } from "@/api";
import { qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MaintenanceAction } from "@/types";

/** What the confirmation dialog is about to do: one of the server actions, or restoring the chosen file. */
type Pending = { kind: "action"; action: MaintenanceAction } | { kind: "restore"; file: File };

const ACTIONS: { action: MaintenanceAction; icon: LucideIcon; danger: boolean }[] = [
  { action: "reload-catalogue", icon: RefreshCw, danger: false },
  { action: "reset-circulation", icon: RotateCcw, danger: true },
  { action: "clear-activity", icon: Eraser, danger: true },
  { action: "delete-members", icon: UserX, danger: true },
  { action: "delete-catalogue", icon: BookX, danger: true },
];

/**
 * Admin-only, in Settings: back up and restore the whole library, reload the catalogue from the inventory,
 * run the scheduled checks, and the resets and deletions. Everything that changes data asks for the admin's
 * password again.
 */
export function MaintenanceSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: counts } = useQuery({ queryKey: qk.maintenance, queryFn: apiMaintenance.counts });

  const open = (p: Pending) => {
    setPending(p);
    setPassword("");
    setError(null);
  };

  const run = useMutation({
    mutationFn: async (p: Pending) => {
      if (p.kind === "restore") await apiMaintenance.restore(p.file, password);
      else await apiMaintenance.run(p.action, password);
      return p;
    },
    onSuccess: (p) => {
      setPending(null);
      if (p.kind === "restore") {
        toast.success(t("maint.restored"));
        // Accounts may have changed under this session: start again from the server's data.
        window.setTimeout(() => window.location.assign("/"), 1200);
        return;
      }
      toast.success(t(`maint.done.${p.action}`));
      return qc.invalidateQueries();
    },
    onError: (e) => setError(errorMessage(t, e)),
  });

  const backup = useMutation({
    mutationFn: apiMaintenance.backup,
    onSuccess: () => {
      toast.success(t("maint.backupDone"));
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const jobs = useMutation({
    mutationFn: apiMisc.runJobs,
    onSuccess: (r) => {
      toast.success(t("maint.jobsDone", { cancelled: r.cancelled, overdue: r.flaggedOverdue, reminders: r.remindersSent }));
      return qc.invalidateQueries();
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) run.mutate(pending);
  };

  const summary: [string, number | undefined][] = [
    [t("maint.count.books"), counts?.books],
    [t("maint.count.copies"), counts?.copies],
    [t("maint.count.accounts"), counts?.accounts],
    [t("maint.count.records"), counts?.records],
    [t("maint.count.activeLoans"), counts?.activeLoans],
  ];

  const row = (key: string, icon: LucideIcon, title: string, body: string, control: React.ReactNode, danger = false) => {
    const Icon = icon;
    return (
      <div key={key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div className="flex min-w-0 max-w-xl items-start gap-3">
          <Icon className={cn("mt-0.5 size-5 shrink-0", danger ? "text-danger" : "text-muted-foreground")} aria-hidden />
          <div>
            <h3 className="text-[15px] font-medium text-ink">{title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          </div>
        </div>
        {control}
      </div>
    );
  };

  const isDanger = pending?.kind === "restore" || (pending?.kind === "action" && ACTIONS.find((a) => a.action === pending.action)?.danger);
  const pendingTitle = pending?.kind === "restore" ? t("maint.restore.title") : pending ? t(`maint.${pending.action}.title`) : "";
  const pendingBody = pending?.kind === "restore"
    ? t("maint.restore.confirm", { file: pending.file.name })
    : pending ? t(`maint.${pending.action}.confirm`) : "";

  return (
    <Panel title={t("maint.title")} flush>
      <p className="px-4 py-3 text-sm text-muted-foreground">{t("maint.sub")}</p>
      <dl className="grid grid-cols-2 border-y sm:grid-cols-5">
        {summary.map(([label, value]) => (
          <div key={label} className="border-e px-4 py-3 last:border-e-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="tabular mt-1 font-display text-xl font-semibold text-ink">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="divide-y">
        {row("backup", DatabaseBackup, t("maint.backup.title"), t("maint.backup.body"),
          <Button variant="outline" disabled={backup.isPending} onClick={() => backup.mutate()}>
            <Download className="size-4" aria-hidden /> {backup.isPending ? t("maint.preparing") : t("maint.backup.button")}
          </Button>)}
        {row("restore", Upload, t("maint.restore.title"), t("maint.restore.body"),
          <>
            <input
              ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) open({ kind: "restore", file });
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> {t("maint.restore.button")}
            </Button>
          </>, true)}
        {row("jobs", History, t("maint.jobs.title"), t("maint.jobs.body"),
          <Button variant="outline" disabled={jobs.isPending} onClick={() => jobs.mutate()}>
            <RefreshCw className="size-4" aria-hidden /> {t("maint.jobs.button")}
          </Button>)}
        {ACTIONS.map(({ action, icon, danger }) =>
          row(action, icon, t(`maint.${action}.title`), t(`maint.${action}.body`),
            <Button
              variant="outline"
              className={cn(danger && "text-danger hover:border-danger/40 hover:bg-danger-soft hover:text-danger")}
              onClick={() => open({ kind: "action", action })}
            >
              {t(`maint.${action}.button`)}
            </Button>, danger))}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o && !run.isPending) setPending(null); }}>
        <DialogContent className="max-w-md bg-white">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{pendingTitle}</DialogTitle>
              <DialogDescription>{pendingBody}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="maint-password">{t("maint.password")}</Label>
              <Input
                id="maint-password" type="password" required autoComplete="current-password" autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={run.isPending} onClick={() => setPending(null)}>{t("common.cancel")}</Button>
              <Button
                type="submit"
                disabled={run.isPending || !password}
                className={cn(isDanger && "bg-danger text-white hover:bg-danger/90")}
              >
                {run.isPending ? t("maint.working") : t("maint.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
