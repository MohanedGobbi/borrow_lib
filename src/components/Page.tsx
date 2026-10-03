import type { ReactNode } from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

/** Page title row: heading, optional description and right-aligned actions. */
export function PageHeader({
  title, description, actions, className,
}: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="type-title text-ink">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bordered white panel with a header row. `flush` drops body padding for tables and lists. */
export function Panel({
  title, count, actions, children, flush, className,
}: {
  title?: ReactNode; count?: number; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-md border bg-card", className)}>
      {(title || actions) && (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            {title}
            {count !== undefined && (
              <span className="tabular rounded-full bg-surface px-2 py-px text-xs font-medium text-muted-foreground">
                {count}
              </span>
            )}
          </h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon, title, children, className,
}: { icon?: LucideIcon; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon && <Icon className="size-8 text-muted-foreground/70" aria-hidden />}
      <p className="mt-3 text-[15px] font-medium text-ink">{title}</p>
      {children && <div className="mt-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center rounded-md border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <AlertCircle className="size-7 text-danger" aria-hidden />
      <p className="mt-3 text-[15px] font-medium text-ink">{message ?? t("common.apiDown")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 bg-white" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

/**
 * Quiet placeholder rows (hairline-divided, no spinner) for a list that is still loading.
 * Lives inside the page shell, under the PageHeader, so the page does not blank out while data arrives.
 */
export function RowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className={cn("divide-y", className)}>
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-6 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-3/5 max-w-sm animate-pulse rounded-sm bg-border/60" />
            <div className="h-3 w-2/5 max-w-xs animate-pulse rounded-sm bg-border/40" />
          </div>
          <div className="hidden h-3.5 w-20 animate-pulse rounded-sm bg-border/60 sm:block" />
        </div>
      ))}
    </div>
  );
}
