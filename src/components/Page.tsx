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
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{description}</div>}
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
