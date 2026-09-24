import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { apiRecords, downloadFile } from "@/api";
import { fmtDate } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import type { BorrowRecord } from "@/types";

/** Receipt button: shows a summary of one request and downloads its PDF. */
export function RequestDocButton({ record }: { record: BorrowRecord }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = `REQ-${String(record.id).padStart(3, "0")}`;

  const download = async () => {
    setBusy(true);
    try {
      await downloadFile(apiRecords.documentUrl(record.id), `${ref}-receipt.pdf`);
      toast.success(t("toast.downloaded"));
    } catch {
      toast.error(t("toast.receiptFail"));
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, React.ReactNode][] = [
    [t("col.member"), record.userName],
    [t("col.id"), <span dir="ltr" className="font-mono text-[13px]">{record.userIdNumber}</span>],
    [t("col.book"), record.bookTitle],
    [t("field.shelf"), <span dir="ltr" className="font-mono text-[13px]">{record.bookShelf || "—"}</span>],
    [t("col.requested"), fmtDate(record.requestedAt)],
    [t("receipt.approved"), fmtDate(record.approvedAt)],
    [t("receipt.deadline"), fmtDate(record.pickupDeadline)],
    [t("col.due"), fmtDate(record.dueDate)],
    [t("receipt.returned"), fmtDate(record.returnedAt)],
  ];

  return (
    <>
      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-ink" onClick={() => setOpen(true)}>
        <FileText className="size-4" aria-hidden /> {t("receipt.button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center justify-between gap-3 pe-6">
              <span>{t("receipt.title")} <span dir="ltr" className="font-mono text-base font-medium text-muted-foreground">{ref}</span></span>
              <StatusBadge status={record.status} />
            </DialogTitle>
          </DialogHeader>
          <dl className="divide-y rounded-md border text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-end font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <Button onClick={download} disabled={busy} className="w-full">
            <Download className="size-4" aria-hidden />
            {busy ? t("common.loading") : t("receipt.download")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
