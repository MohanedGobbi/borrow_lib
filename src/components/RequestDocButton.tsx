import { useState } from "react";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import { apiRecords, downloadFile } from "@/api";
import { fmtDate } from "@/components/Countdown";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import type { BorrowRecord } from "@/types";

/**
 * Receipt button + sub-window (modal) for one borrow request.
 * Shows a summary and downloads the server-generated REQ-xxx PDF.
 */
export function RequestDocButton({ record }: { record: BorrowRecord }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await downloadFile(apiRecords.documentUrl(record.id), `REQ-${String(record.id).padStart(3, "0")}-receipt.pdf`);
      toast.success("Receipt PDF downloaded.");
    } catch {
      toast.error("Could not download the receipt — is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [
    ["Member", record.userName],
    ["ID", record.userIdNumber],
    ["Book", record.bookTitle],
    ["Shelf", record.bookShelf],
    ["Requested", fmtDate(record.requestedAt)],
    ["Approved", fmtDate(record.approvedAt)],
    ["Pickup deadline", fmtDate(record.pickupDeadline)],
    ["Due", fmtDate(record.dueDate)],
    ["Returned", fmtDate(record.returnedAt)],
  ];

  return (
    <>
      <Button size="sm" variant="outline" className="border-ink/30" onClick={() => setOpen(true)}>
        <FileText className="mr-1 size-3.5" /> {t("dash.doc")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>REQ-{String(record.id).padStart(3, "0")} · {t("dash.doc")}</span>
              <StatusBadge status={record.status} />
            </DialogTitle>
          </DialogHeader>
          <div className="divide-y divide-border rounded-sm border border-border">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-3 py-1.5 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</span>
                <span className="text-right font-medium">{v}</span>
              </div>
            ))}
          </div>
          <Button onClick={download} disabled={busy} className="mt-2 w-full bg-ink text-white hover:bg-ink/90">
            <Download className="mr-1.5 size-4" />
            {busy ? "…" : "Download PDF receipt"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
