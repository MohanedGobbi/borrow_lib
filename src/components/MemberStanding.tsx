import { AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { useI18n } from "@/i18n";
import type { Profile } from "@/types";

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
