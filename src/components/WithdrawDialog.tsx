import { useI18n } from "@/i18n";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** What the student is taking back: a pending request, a copy held for them, or their place in a waiting list. */
export interface WithdrawTarget {
  kind: "request" | "hold" | "waitlist";
  id: number;
  title: string;
}

/**
 * Asks before a student gives up a request, a hold or a place in line. It names the book, and for a hold it
 * says where the copy goes. Open it by setting `target`; "keep it" is the default focus.
 */
export function WithdrawDialog({
  target, onOpenChange, onConfirm,
}: {
  target: WithdrawTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: WithdrawTarget) => void;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      {target && (
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`withdraw.${target.kind}.title`)}</AlertDialogTitle>
            <AlertDialogDescription>{t(`withdraw.${target.kind}.body`, { title: target.title })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("withdraw.keep")}</AlertDialogCancel>
            <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => onConfirm(target)}>
              {t(`withdraw.${target.kind}.confirm`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
