import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { apiExports, type ExportFormat } from "@/api";
import { DEMO } from "@/api/client";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BorrowStatus } from "@/types";

const STATUSES: BorrowStatus[] = ["PENDING", "READY", "BORROWED", "OVERDUE", "RETURNED", "REJECTED", "CANCELLED"];

/** Runs one export download and reports the outcome in a toast. */
function useExporter() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = async (download: () => Promise<void>) => {
    setBusy(true);
    try {
      await download();
      toast.success(t("toast.downloaded"));
      return true;
    } catch (e) {
      toast.error(errorMessage(t, e, "export.failed"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/**
 * "Export" button for the inventory: a menu with CSV and Excel. The demo build cannot write Excel files,
 * so there it is a single CSV button.
 */
export function BooksExportMenu({ search }: { search: string }) {
  const { t } = useI18n();
  const { busy, run } = useExporter();
  const download = (format: ExportFormat) => run(() => apiExports.books(format, { search }));

  if (DEMO) {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => download("csv")}>
        <Download className="size-4" aria-hidden /> {t("export.csvButton")}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy}>
          <Download className="size-4" aria-hidden /> {t("export.button")} <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={() => download("csv")}>{t("export.csv")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => download("xlsx")}>{t("export.xlsx")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Loans export: pick the statuses and a requested-on date range, then download CSV or Excel. */
export function LoansExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const { busy, run } = useExporter();
  const [statuses, setStatuses] = useState<BorrowStatus[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time the dialog opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) { setStatuses([]); setFrom(""); setTo(""); setFormat("csv"); setError(null); }
  }

  const toggle = (status: BorrowStatus, on: boolean) =>
    setStatuses((list) => (on ? [...list, status] : list.filter((s) => s !== status)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (from && to && to < from) {
      setError(t("export.rangeInvalid"));
      return;
    }
    setError(null);
    const ok = await run(() => apiExports.loans(DEMO ? "csv" : format, { status: statuses, from, to }));
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t("export.loansTitle")}</DialogTitle>
            <DialogDescription>{t("export.loansDesc")}</DialogDescription>
          </DialogHeader>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t("col.status")}</legend>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("export.statusHelp")}</p>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STATUSES.map((status) => (
                <div key={status} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`export-status-${status}`}
                    checked={statuses.includes(status)}
                    onCheckedChange={(on) => toggle(status, on === true)}
                  />
                  <Label htmlFor={`export-status-${status}`} className="text-[15px] font-normal">{t(`status.${status}`)}</Label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="export-from">{t("export.from")}</Label>
              <Input id="export-from" type="date" dir="ltr" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-to">{t("export.to")}</Label>
              <Input id="export-to" type="date" dir="ltr" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {!DEMO && (
            <div className="space-y-1.5">
              <Label>{t("export.format")}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger aria-label={t("export.format")} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">{t("export.csv")}</SelectItem>
                  <SelectItem value="xlsx">{t("export.xlsx")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={busy}>
              <Download className="size-4" aria-hidden /> {busy ? t("export.preparing") : t("export.download")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
