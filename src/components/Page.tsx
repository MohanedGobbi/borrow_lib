import type { ReactNode, Ref } from "react";
import { Link } from "react-router";
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
  title, count, actions, children, flush, className, headingRef,
}: {
  title?: ReactNode; count?: number; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string;
  /** Makes the heading focusable by script (not by Tab), for moving focus here when a list empties. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <section className={cn("overflow-hidden rounded-md border bg-card", className)}>
      {(title || actions) && (
        <header className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
          <h2
            ref={headingRef} tabIndex={headingRef ? -1 : undefined}
            className="flex items-baseline gap-2 text-[15px] font-semibold text-ink"
          >
            {title}
            {count !== undefined && (
              <span className="tabular text-[13px] font-normal text-muted-foreground">{count}</span>
            )}
          </h2>
          {actions && <div className="flex max-w-full flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/**
 * A row of large figures for the top of a staff screen: the label above, the number set in the serif display face.
 * Hairlines between cells come from a 1px gap over a border-coloured ground, so any number of cells divides evenly.
 * A cell with `to` is a link (the whole cell); `danger` is for late items only.
 */
export type Figure = { label: string; value: ReactNode; to?: string; danger?: boolean; help?: string };

export function Figures({ items, className }: { items: Figure[]; className?: string }) {
  return (
    <dl className={cn("grid gap-px overflow-hidden rounded-md border bg-border", className)}>
      {items.map((f) => (
        <div key={f.label} className="group relative bg-card p-4 transition-colors has-[a]:hover:bg-surface sm:p-5">
          <dt className="text-[13px] text-muted-foreground">
            {f.to ? (
              <Link to={f.to} className="rounded-sm after:absolute after:inset-0 group-hover:text-ink">{f.label}</Link>
            ) : f.label}
          </dt>
          <dd className={cn("tabular mt-2 font-display text-[2.25rem] font-medium leading-none tracking-[-0.01em]", f.danger ? "text-danger" : "text-ink")}>
            {f.value ?? "—"}
          </dd>
          {f.help && <dd className="mt-2 text-xs text-muted-foreground">{f.help}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  icon: Icon, title, children, className,
}: { icon?: LucideIcon; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className={cn("text-[15px] font-medium text-ink", Icon && "mt-4")}>{title}</p>
      {children && <div className="mt-3 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** A failed load: named plainly in the neutral palette (red is kept for late, rejected and destructive). */
export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center rounded-md border bg-surface px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-white text-ink ring-1 ring-border">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-[15px] font-medium text-ink">{message ?? t("common.apiDown")}</p>
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
        <div key={i} aria-hidden className="flex items-center gap-6 px-4 py-[1.125rem]">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-3.5 w-3/5 max-w-sm animate-pulse rounded-sm bg-border/50" />
            <div className="h-3 w-2/5 max-w-xs animate-pulse rounded-sm bg-border/30" />
          </div>
          <div className="hidden h-3.5 w-20 animate-pulse rounded-sm bg-border/50 sm:block" />
        </div>
      ))}
    </div>
  );
}
