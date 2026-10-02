import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Previous / next with "Page x of y". Renders nothing when everything fits on one page. */
export function Pager({
  page, pageSize, count, onPage, className,
}: { page: number; pageSize: number; count: number; onPage: (page: number) => void; className?: string }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;

  return (
    <nav aria-label={t("pager.label")} className={cn("flex items-center justify-between gap-3 border-t px-4 py-3", className)}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("pager.prev")}
      </Button>
      <span className="tabular text-sm text-muted-foreground" aria-live="polite">
        {t("pager.pageOf", { page, pages })}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t("pager.next")} <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
      </Button>
    </nav>
  );
}

/** "Showing 100 of 240", for lists that load one capped page and have no pager. */
export function ShowingNote({ shown, count, className }: { shown: number; count: number; className?: string }) {
  const { t } = useI18n();
  if (count <= shown) return null;
  return (
    <p className={cn("border-t px-4 py-3 text-sm text-muted-foreground", className)}>
      {t("pager.showing", { shown, count })}
    </p>
  );
}
