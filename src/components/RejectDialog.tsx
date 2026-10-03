import { useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BorrowRecord } from "@/types";

export const REJECTION_REASON_MAX = 300;

/** Rejecting is final, so staff confirm it here and can tell the student why. Open it by setting `record`. */
export function RejectDialog({
  record, onOpenChange, onConfirm,
}: {
  record: BorrowRecord | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: BorrowRecord, reason: string) => void;
}) {
  return (
    <AlertDialog open={record !== null} onOpenChange={onOpenChange}>
      {record && <RejectBody record={record} onConfirm={onConfirm} />}
    </AlertDialog>
  );
}

// Mounted only while the dialog is open, so the reason starts empty every time.
function RejectBody({ record, onConfirm }: { record: BorrowRecord; onConfirm: (record: BorrowRecord, reason: string) => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  return (
    <AlertDialogContent
      className="bg-white"
      // The reason is what staff came here to write: start in it. Cancel stays one Tab away.
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        fieldRef.current?.focus();
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t("reject.title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("reject.body", { member: record.userName, title: record.bookTitle })}</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2">
        <Label htmlFor="reject-reason">{t("reject.reason")}</Label>
        <Textarea
          id="reject-reason" ref={fieldRef} value={reason} maxLength={REJECTION_REASON_MAX} rows={3}
          dir="auto" placeholder={t("reject.reasonPlaceholder")} aria-describedby="reject-reason-help"
          onChange={(e) => setReason(e.target.value)}
        />
        <p id="reject-reason-help" className="flex justify-between gap-4 text-xs text-muted-foreground">
          <span>{t("reject.reasonHelp")}</span>
          <bdi dir="ltr" className="tabular shrink-0">{reason.length} / {REJECTION_REASON_MAX}</bdi>
        </p>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
        <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => onConfirm(record, reason.trim())}>
          {t("reject.confirm")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
