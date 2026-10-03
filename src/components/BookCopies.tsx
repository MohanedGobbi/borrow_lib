import { Link } from "react-router";
import { AlertTriangle, BookOpen, Library, PackageCheck, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { Panel } from "@/components/Page";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BookCopy } from "@/types";

const STATE: Record<BookCopy["state"], { icon: LucideIcon; tone: string }> = {
  ON_SHELF: { icon: Library, tone: "text-brand-dark" },
  HELD: { icon: PackageCheck, tone: "text-ink" },
  BORROWED: { icon: BookOpen, tone: "text-ink" },
  OVERDUE: { icon: AlertTriangle, tone: "text-danger" },
};

/** One row per physical copy: on the shelf, held for pickup, on loan or overdue. Staff also see who has it. */
export function BookCopies({ copies }: { copies: BookCopy[] }) {
  const { t } = useI18n();

  const detail = (c: BookCopy) => {
    if (c.state === "ON_SHELF") {
      return <>{t("field.shelf")} <span dir="ltr" className="font-mono text-[13px] text-ink">{c.shelf || "—"}</span></>;
    }
    if (c.state === "HELD") return t("copies.heldUntil", { date: fmtDateTime(c.heldUntil ?? null) });
    if (c.state === "OVERDUE") return t("copies.wasDue", { date: fmtDate(c.dueDate ?? null) });
    // The public list leaves out the date of a copy that is late: "on loan" is all a student needs to know.
    if (!c.dueDate) return t("copies.backSoon");
    return t("copies.dueBack", { date: fmtDate(c.dueDate) });
  };

  return (
    <Panel title={t("copies.title")} count={copies.length} flush>
      <ul className="divide-y">
        {copies.map((c) => {
          const { icon: Icon, tone } = STATE[c.state];
          return (
            <li
              key={c.copy}
              className={cn(
                "grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[6.5rem_11rem_minmax(0,1fr)_auto]",
                c.state === "OVERDUE" && "bg-danger-soft/40",
              )}
            >
              <span className="font-medium text-ink">{t("copies.copy", { n: c.copy })}</span>
              <span className={cn("inline-flex items-center gap-1.5 font-medium", tone)}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(`copies.${c.state}`)}
              </span>
              <span className="col-start-2 text-muted-foreground sm:col-start-auto">{detail(c)}</span>
              {c.userName && (
                <Link
                  dir="auto"
                  to={`/staff/users/${c.userProfileId}`}
                  className="col-start-2 font-medium text-ink hover:text-brand-dark hover:underline sm:col-start-auto sm:text-end"
                >
                  {c.userName}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
