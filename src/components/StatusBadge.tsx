import { cn } from "@/lib/utils";
import type { BorrowStatus } from "@/types";
import { STATUS_LABEL } from "@/types";

const STYLES: Record<BorrowStatus, string> = {
  PENDING: "bg-brand-soft text-brand-dark border-brand/40",
  READY: "bg-warning/15 text-warning border-warning/40",
  BORROWED: "bg-success/10 text-success border-success/40",
  RETURNED: "bg-muted text-muted-foreground border-border",
  REJECTED: "bg-ink/5 text-ink/60 border-ink/20",
  CANCELLED: "bg-ink/5 text-ink/60 border-ink/20",
  OVERDUE: "bg-danger/10 text-danger border-danger/40",
};

export function StatusBadge({ status, className }: { status: BorrowStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider",
        STYLES[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
