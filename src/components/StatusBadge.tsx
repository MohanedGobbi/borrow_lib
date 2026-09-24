import { AlertTriangle, Ban, BookOpen, CheckCircle2, Clock, PackageCheck, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { BorrowStatus } from "@/types";

// Every status carries an icon as well as a color, so it never depends on red/green alone.
const STYLES: Record<BorrowStatus, { icon: LucideIcon; className: string }> = {
  PENDING: { icon: Clock, className: "border-border bg-surface text-ink/80" },
  READY: { icon: PackageCheck, className: "border-brand/40 bg-white text-brand-dark" },
  BORROWED: { icon: BookOpen, className: "border-transparent bg-brand-soft text-brand-dark" },
  RETURNED: { icon: CheckCircle2, className: "border-border bg-white text-muted-foreground" },
  REJECTED: { icon: XCircle, className: "border-border bg-white text-muted-foreground" },
  CANCELLED: { icon: Ban, className: "border-border bg-white text-muted-foreground" },
  OVERDUE: { icon: AlertTriangle, className: "border-danger/30 bg-danger-soft text-danger" },
};

export function StatusBadge({ status, className }: { status: BorrowStatus; className?: string }) {
  const { t } = useI18n();
  const { icon: Icon, className: tone } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(`status.${status}`)}
    </span>
  );
}
