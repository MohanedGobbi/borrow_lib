import { useState } from "react";
import { Link, useParams } from "react-router";
import { BookX, CheckCircle2, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiBooks, apiRecords, apiReservations } from "@/api";
import { qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { useDeferredAction } from "@/hooks/useDeferredAction";
import { DeferredRowAction } from "@/components/DeferredRowAction";
import { BookCover } from "@/components/BookCover";
import { BorrowNotice } from "@/components/BorrowNotice";
import { Availability, BookActions, type BookActionResult } from "@/components/BookActions";
import { BookEditDialog } from "@/components/BookEditDialog";
import { BookCopies } from "@/components/BookCopies";
import { StatusBadge } from "@/components/StatusBadge";
import { Container } from "@/components/Layout";
import { EmptyState, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { fmtDate } from "@/lib/time";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";

export default function BookDetailPage() {
  const { me, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const ruleVars = useRuleVars();
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [done, setDone] = useState<BookActionResult | null>(null);
  const { data: book, isPending, isError } = useQuery({ queryKey: qk.books.detail(id!), queryFn: () => apiBooks.get(id!) });
  const isStaff = !!me && me.role !== "MEMBER";

  // Staff see borrower names in the copy list, so wait until the session is known before asking.
  const { data: copies } = useQuery({
    queryKey: qk.books.copies(id!), queryFn: () => apiBooks.copies(id!), enabled: !authLoading,
  });
  const { data: queue } = useQuery({
    queryKey: qk.reservations.forBook(id!), queryFn: () => apiReservations.forBook(Number(id)), enabled: isStaff,
  });
  const loanParams = { book: Number(id), pageSize: 100 };
  const { data: loanPage } = useQuery({
    queryKey: qk.records.list(loanParams), queryFn: () => apiRecords.list(loanParams), enabled: isStaff,
  });
  const loans = loanPage?.results;
  const deferred = useDeferredAction();

  if (isPending) return <FullPageLoader />;
  if (isError || !book) {
    return (
      <Container>
        <EmptyState icon={BookX} title={t("book.notFound")}>
          <Button asChild variant="outline" size="sm"><Link to="/catalog">{t("book.back")}</Link></Button>
        </EmptyState>
      </Container>
    );
  }

  const active = (loans ?? []).filter((r) => ["BORROWED", "OVERDUE", "READY", "PENDING"].includes(r.status));
  const out = book.freeCopies <= 0;
  const nextBack = (copies ?? [])
    .filter((c) => c.state === "BORROWED" && c.dueDate)
    .map((c) => c.dueDate!)
    .sort()[0];

  const meta: [string, React.ReactNode][] = [
    [t("field.isbn"), <span dir="ltr" className="font-mono text-[13px]">{book.isbn}</span>],
    [t("field.shelf"), <span dir="ltr" className="font-mono text-[13px]">{book.shelfLocation || "—"}</span>],
    [t("field.category"), <span dir="auto">{book.category.name}</span>],
    [t("field.publisher"), <span dir="auto">{book.publisher || "—"}</span>],
    [t("field.year"), book.year ?? "—"],
    [t("field.copies"), <span className="tabular">{book.totalCopies}</span>],
  ];

  return (
    <Container>
      <BorrowNotice className="mb-6" />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/catalog" className="hover:text-ink hover:underline">{t("book.back")}</Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <Link to={`/catalog?category=${encodeURIComponent(book.category.name)}`} className="hover:text-ink hover:underline">
          {book.category.name}
        </Link>
      </nav>

      {/* Phones: title beside a thumbnail cover, then availability and the request buttons, the copies, the details.
          md and up: cover, content and availability side by side, the copies below. */}
      <div className="mt-8 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-5 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-10 lg:mt-10 lg:grid-cols-[15rem_minmax(0,1fr)_20rem] lg:gap-x-14">
        <div className="col-start-1 row-start-1 md:row-span-2">
          <BookCover book={book} size="hero" />
        </div>

        <div className="col-start-2 row-start-1 min-w-0">
          <h1 className="type-display text-[1.75rem] text-ink sm:text-[2.25rem] lg:text-[2.875rem]"><bdi>{book.title}</bdi></h1>
          <p className="mt-3 text-lead text-muted-foreground md:mt-4 md:text-lg">{t("book.by")} <bdi className="text-ink">{book.author}</bdi></p>
        </div>

        <aside className="col-span-2 row-start-2 mt-8 h-fit rounded-lg border bg-white p-6 shadow-[0_1px_2px_rgb(16_24_20/0.04),0_8px_24px_-16px_rgb(16_24_20/0.18)] md:col-start-1 md:row-start-3 md:mt-10 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:mt-0">
          <h2 className="text-[13px] font-semibold text-muted-foreground">{t("book.availability")}</h2>
          <p className={out ? "mt-2 font-display text-2xl font-semibold leading-tight text-ink" : "mt-2 font-display text-2xl font-semibold leading-tight text-brand-dark"}>
            {out ? t("book.allOut") : t("book.onShelf")}
          </p>
          {!out && <Availability book={book} className="mt-2" />}
          {out && nextBack && (
            <p className="mt-1 text-sm text-ink">{t("copies.nextBack", { date: fmtDate(nextBack) })}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {t("field.shelf")} <span dir="ltr" className="font-mono text-[13px] text-ink">{book.shelfLocation || "—"}</span>
          </p>
          {/* The confirmation replaces the buttons: asking again would only say "already requested". */}
          <div role="status">
            {done ? <ActionConfirmation result={done} /> : null}
          </div>
          {!done && (
            <BookActions
              book={book}
              size="default"
              className="mt-5 w-full"
              onEdit={isStaff ? () => setEditOpen(true) : undefined}
              onDone={setDone}
            />
          )}
          <p className="mt-5 border-t pt-4 text-sm leading-relaxed text-muted-foreground">{t("book.rules", ruleVars)}</p>
        </aside>

        {(copies ?? []).length > 0 && (
          <div className="col-span-full row-start-3 mt-10 md:row-start-4 md:mt-14 lg:row-start-3">
            <BookCopies copies={copies!} />
          </div>
        )}

        <div className="col-span-full row-start-4 min-w-0 md:col-span-1 md:col-start-2 md:row-start-2 lg:row-start-2">
          {book.description && (
            <p className="mt-8 max-w-[62ch] text-base leading-[1.7] text-ink/90 md:text-[17px]"><bdi>{book.description}</bdi></p>
          )}

          <h2 className="mt-10 text-[13px] font-semibold text-muted-foreground">{t("book.details")}</h2>
          <dl className="mt-3 grid max-w-xl grid-cols-[auto_1fr] gap-x-10 border-t text-[15px]">
            {meta.map(([k, v]) => (
              <div key={k} className="col-span-2 grid grid-cols-subgrid border-b py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {isStaff && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title={t("book.currentBorrowers")} count={active.length} flush>
            {active.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("book.noLoans")}</p>
            ) : (
              <div className={tableCls.wrap}>
                <table className={tableCls.table}>
                  <thead>
                    <tr>
                      <th className={tableCls.th}>{t("col.member")}</th>
                      <th className={tableCls.th}>{t("col.requested")}</th>
                      <th className={tableCls.th}>{t("col.due")}</th>
                      <th className={tableCls.th}>{t("col.status")}</th>
                      <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((r) => (
                      <tr key={r.id} className={tableCls.row}>
                        <td className={tableCls.td}>
                          <Link dir="auto" to={`/staff/users/${r.userProfileId}`} className="font-medium text-ink hover:text-brand-dark hover:underline">{r.userName}</Link>
                        </td>
                        <td className={tableCls.td}>{fmtDate(r.requestedAt)}</td>
                        <td className={tableCls.td}>{fmtDate(r.dueDate)}</td>
                        <td className={tableCls.td}><StatusBadge status={r.status} /></td>
                        <td className={cn(tableCls.td, "text-end")}>
                          {(r.status === "BORROWED" || r.status === "OVERDUE") && (
                            <DeferredRowAction kind="return" record={r} deferred={deferred} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={t("book.queue")} count={(queue ?? []).length} flush>
            {(queue ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("dash.noReservations")}</p>
            ) : (
              <ol className="divide-y">
                {(queue ?? []).map((q) => (
                  <li key={q.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="tabular flex size-6 items-center justify-center rounded-full bg-surface text-xs font-semibold">{q.position}</span>
                    <Link dir="auto" to={`/staff/users/${q.userProfileId}`} className="flex-1 font-medium hover:text-brand-dark hover:underline">{q.userName}</Link>
                    <span className="text-muted-foreground">{fmtDate(q.reservedAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      <BookEditDialog book={book} open={editOpen} onOpenChange={setEditOpen} />
    </Container>
  );
}

/** What happens next, right where the student just acted (a toast alone is gone before it is read). */
function ActionConfirmation({ result }: { result: BookActionResult }) {
  const { t } = useI18n();
  const ruleVars = useRuleVars();
  const queued = result.kind === "queued";
  const text =
    result.kind === "requested" ? t("book.requestedInline", ruleVars)
      : result.position != null ? t("book.queuedInline", { position: result.position, ...ruleVars })
        : t("book.queuedInlinePlain", ruleVars);
  return (
    <div className="mt-5 rounded-md bg-brand-soft p-4">
      <p className="flex gap-2.5 text-sm leading-relaxed text-ink">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-dark" aria-hidden />
        <span>{text}</span>
      </p>
      <Link to="/my-requests" className="mt-3 inline-block ps-[26px] text-sm font-medium text-brand-dark underline-offset-4 hover:underline">
        {t(queued ? "book.viewWaitingList" : "book.viewMyLoans")}
      </Link>
    </div>
  );
}
