import { AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { useI18n } from "@/i18n";
import type { BorrowRecord, Profile } from "@/types";

/** Member standing: inactive, blocked by an overdue loan, or in good standing. */
export function MemberStanding({ member }: { member: Profile }) {
  const { t } = useI18n();
  if (!member.active) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
        <CircleSlash className="size-4" aria-hidden /> {t("users.inactive")}
      </span>
    );
  }
  if (member.hasOverdue) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-danger">
        <AlertTriangle className="size-4" aria-hidden /> {t("users.blocked")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-brand-dark">
      <CheckCircle2 className="size-4" aria-hidden /> {t("users.goodStanding")}
    </span>
  );
}

/**
 * The member's standing as a desk queue sees it: a flag only when something blocks or limits them.
 * `pickup` is for a hold that is already approved: only an overdue loan matters there (the hold counts toward the limit).
 */
export function RecordStanding({ record, pickup }: { record: BorrowRecord; pickup?: boolean }) {
  const { t } = useI18n();
  if (record.memberHasOverdue) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-danger">
        <AlertTriangle className="size-3.5" aria-hidden /> {t("users.blocked")}
      </span>
    );
  }
  if (!pickup && record.memberActiveLoans >= record.memberMaxBorrowLimit) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink/80">
        <CircleSlash className="size-3.5" aria-hidden /> {t("desk.atLimit")}
        <bdi dir="ltr" className="tabular font-normal text-muted-foreground">{record.memberActiveLoans} / {record.memberMaxBorrowLimit}</bdi>
      </span>
    );
  }
  return null;
}
