import { Link } from "react-router";
import { AlertTriangle, CircleSlash } from "lucide-react";
import { useI18n } from "@/i18n";
import { useRequestGuard } from "@/hooks/useRequestGuard";
import { cn } from "@/lib/utils";

/**
 * A slim notice for a student who cannot request right now (overdue loan, or the borrowing limit is full),
 * with the way to My loans. Overdue gets the red wash, the same as the banner on My loans; the limit is neutral.
 */
export function BorrowNotice({ className }: { className?: string }) {
  const { t } = useI18n();
  const guard = useRequestGuard();
  if (!guard.kind || !guard.notice) return null;
  const overdue = guard.kind === "overdue";
  const Icon = overdue ? AlertTriangle : CircleSlash;
  return (
    <div
      role={overdue ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-4 py-2.5 text-sm",
        overdue ? "border-danger/30 bg-danger-soft text-ink/90" : "bg-surface text-ink/85",
        className,
      )}
    >
      <Icon className={cn("size-4 shrink-0", overdue && "text-danger")} aria-hidden />
      <p className="min-w-0 flex-1 basis-64">{guard.notice}</p>
      <Link to="/my-requests" className={cn("shrink-0 font-medium underline-offset-4 hover:underline", overdue ? "text-danger" : "text-brand-dark")}>
        {t("notice.viewLoans")}
      </Link>
    </div>
  );
}
