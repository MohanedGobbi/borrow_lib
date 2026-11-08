import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, RotateCw, type LucideIcon } from "lucide-react";
import { apiMaintenance } from "@/api";
import { qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { fmtDateTimeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { UpdateState, UpdateStatus } from "@/types";

const BUSY: UpdateState[] = ["checking", "downloading", "installing"];
const POLL_MS = 4000;
const GIVE_UP_MS = 3 * 60_000; // the server picks a request up within seconds; past this it waits for the night

/** A "Check now" in progress: what the report said before it, so the answer can be told apart. */
type Watch = { since: number; checkedAt: string | null; version: string };

const isBusy = (s: UpdateStatus | undefined) => !!s && (s.requested || BUSY.includes(s.state));

/**
 * Admin-only, in Settings: the installed version and the server's nightly automatic updates
 * (deploy/auto-update.sh), with a button that asks the server to check GitHub for a new release now.
 */
export function UpdateSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [watch, setWatch] = useState<Watch | null>(null);
  const watchRef = useRef<Watch | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setWatching = (w: Watch | null) => {
    watchRef.current = w;
    setWatch(w);
  };

  /** After "Check now": settle once the report changed and the server is no longer busy. */
  const settle = (s: UpdateStatus | null) => {
    const w = watchRef.current;
    if (!w) return;
    if (s?.version && s.version !== w.version) {
      setWatching(null);
      setNewVersion(s.version);
      toast.success(t("update.done.updated", { version: s.version }));
    } else if (s && !isBusy(s) && s.checkedAt !== w.checkedAt) {
      setWatching(null);
      if (s.state === "up_to_date") toast.success(t("update.done.upToDate"));
      else if (s.state === "failed" || s.state === "skipped" || s.state === "error") toast.error(t("update.done.failed"));
    } else if (Date.now() - w.since > GIVE_UP_MS) {
      setWatching(null);
      toast.message(t("update.done.later"));
    }
  };

  const { data, isError } = useQuery({
    queryKey: qk.update,
    queryFn: async () => {
      try {
        const s = await apiMaintenance.updateStatus();
        settle(s);
        return s;
      } catch (e) {
        settle(null); // the site restarts once while it updates: expected, keep asking
        throw e;
      }
    },
    refetchInterval: (q) => (watch || isBusy(q.state.data) ? POLL_MS : false),
    retry: watch ? false : 3,
  });

  const request = useMutation({
    mutationFn: () => apiMaintenance.requestUpdate(password),
    onSuccess: (status) => {
      setDialog(false);
      setWatching({ since: Date.now(), checkedAt: data?.checkedAt ?? null, version: data?.version ?? status.version });
      qc.setQueryData(qk.update, status);
      toast.success(t("update.requestedToast"));
    },
    onError: (e) => setError(errorMessage(t, e)),
  });

  const openDialog = () => {
    setPassword("");
    setError(null);
    setDialog(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    request.mutate();
  };

  const busy = !!watch || isBusy(data);
  const [Icon, tone, text] = describe(t, data, !!watch && isError);

  const facts: [string, string, boolean][] = [
    [t("update.installed"), data?.version || "—", true],
    [t("update.latest"), data?.latest || "—", true],
    [t("update.lastCheck"), data?.checkedAt ? fmtDateTimeAgo(data.checkedAt) : t("update.never"), false],
  ];

  return (
    <Panel title={t("update.title")} flush>
      <p className="px-4 py-3 text-sm text-muted-foreground">{t("update.sub")}</p>
      <dl className="grid grid-cols-1 border-y sm:grid-cols-3">
        {facts.map(([label, value, latin]) => (
          <div key={label} className="border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("mt-1 text-ink", latin ? "font-mono text-lg font-semibold" : "text-[15px]")}>
              {latin ? <span dir="ltr">{value}</span> : value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <div role="status" aria-live="polite" className="flex min-w-0 max-w-xl items-start gap-2.5">
          <Icon
            className={cn("mt-0.5 size-5 shrink-0", tone, Icon === Loader2 && "animate-spin motion-reduce:animate-none")}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[15px] text-ink">{text}</p>
            {data?.message && (data.state === "error" || data.state === "failed") && (
              <p dir="ltr" className="mt-1 break-words text-start font-mono text-xs text-muted-foreground">{data.message}</p>
            )}
          </div>
        </div>
        {newVersion ? (
          <Button onClick={() => window.location.reload()}>
            <RotateCw className="size-4" aria-hidden /> {t("update.reload")}
          </Button>
        ) : (
          <Button variant="outline" disabled={!data?.available || busy} onClick={openDialog}>
            <RefreshCw className={cn("size-4", busy && "animate-spin motion-reduce:animate-none")} aria-hidden />
            {busy ? t("update.working") : t("update.button")}
          </Button>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={(o) => { if (!o && !request.isPending) setDialog(false); }}>
        <DialogContent className="max-w-md bg-white">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("update.confirmTitle")}</DialogTitle>
              <DialogDescription>{t("update.confirmBody")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="update-password">{t("maint.password")}</Label>
              <Input
                id="update-password" type="password" required autoComplete="current-password" autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={request.isPending} onClick={() => setDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={request.isPending || !password}>
                {request.isPending ? t("maint.working") : t("update.button")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** The status line: an icon and a sentence, so the state never rests on colour alone. */
function describe(t: T, s: UpdateStatus | undefined, restarting: boolean): [LucideIcon, string, string] {
  const muted = "text-muted-foreground";
  if (!s) return [Loader2, muted, t("update.loading")];
  if (!s.available) return [Info, muted, t("update.off")];
  if (restarting) return [Loader2, "text-brand", t("update.restarting")];
  if (s.requested) return [Loader2, "text-brand", t("update.requested")];
  const vars = { version: s.latest, current: s.version };
  switch (s.state) {
    case "checking": return [Loader2, "text-brand", t("update.state.checking")];
    case "downloading": return [Loader2, "text-brand", t("update.state.downloading", vars)];
    case "installing": return [Loader2, "text-brand", t("update.state.installing", vars)];
    case "up_to_date": return [CheckCircle2, "text-brand", t("update.state.up_to_date")];
    case "updated": return [CheckCircle2, "text-brand", t("update.state.updated", { version: s.version })];
    case "failed": return [AlertTriangle, "text-danger", t("update.state.failed", vars)];
    case "skipped": return [AlertTriangle, "text-danger", t("update.state.skipped", vars)];
    case "error": return [AlertTriangle, "text-danger", t("update.state.error")];
    default: return [Info, muted, t("update.state.never")];
  }
}
