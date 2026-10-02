import { useState } from "react";
import { Link, useParams } from "react-router";
import { BookX, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiBooks, apiRecords, apiReservations } from "@/api";
import { qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { BookCover } from "@/components/BookCover";
import { Availability, BookActions } from "@/components/BookActions";
import { BookEditDialog } from "@/components/BookEditDialog";
import { BookCopies } from "@/components/BookCopies";
import { StatusBadge } from "@/components/StatusBadge";
import { Container } from "@/components/Layout";
import { EmptyState, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { fmtDate } from "@/lib/time";
import { tableCls } from "@/lib/table";

export default function BookDetailPage() {
  const { me, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
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
    [t("field.category"), book.category.name],
    [t("field.publisher"), book.publisher || "—"],
    [t("field.year"), book.year ?? "—"],
    [t("field.copies"), <span className="tabular">{book.totalCopies}</span>],
  ];

  return (
    <Container>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/catalog" className="hover:text-ink hover:underline">{t("book.back")}</Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <Link to={`/catalog?category=${encodeURIComponent(book.category.name)}`} className="hover:text-ink hover:underline">
          {book.category.name}
        </Link>
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)_20rem] lg:gap-10">
        <div className="max-w-[14rem]">
          <BookCover book={book} size="lg" />
        </div>

        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-3xl">{book.title}</h1>
          <p className="mt-1.5 text-[17px] text-muted-foreground">{t("book.by")} <span className="text-ink">{book.author}</span></p>

          {book.description && (
            <p className="mt-6 max-w-[65ch] text-[15px] leading-relaxed text-ink/90">{book.description}</p>
          )}

          <h2 className="mt-8 text-sm font-semibold text-ink">{t("book.details")}</h2>
          <dl className="mt-3 grid max-w-xl grid-cols-[auto_1fr] gap-x-8 border-t text-[15px]">
            {meta.map(([k, v]) => (
              <div key={k} className="col-span-2 grid grid-cols-subgrid border-b py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="h-fit rounded-md border bg-white p-5 md:col-span-2 lg:col-span-1">
          <h2 className="text-sm font-semibold text-ink">{t("book.availability")}</h2>
          <p className={out ? "mt-2 text-lg font-semibold text-ink" : "mt-2 text-lg font-semibold text-brand-dark"}>
            {out ? t("book.allOut") : t("book.onShelf")}
          </p>
          {!out && <Availability book={book} className="mt-1" />}
          {out && nextBack && (
            <p className="mt-1 text-sm text-ink">{t("copies.nextBack", { date: fmtDate(nextBack) })}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {t("field.shelf")} <span dir="ltr" className="font-mono text-[13px] text-ink">{book.shelfLocation || "—"}</span>
          </p>
          <BookActions
            book={book}
            size="default"
            className="mt-5 w-full"
            onEdit={isStaff ? () => setEditOpen(true) : undefined}
          />
          <p className="mt-4 border-t pt-4 text-sm leading-relaxed text-muted-foreground">{t("book.rules")}</p>
        </aside>
      </div>

      {(copies ?? []).length > 0 && (
        <div className="mt-10">
          <BookCopies copies={copies!} />
        </div>
      )}

      {isStaff && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((r) => (
                      <tr key={r.id} className={tableCls.row}>
                        <td className={tableCls.td}>
                          <Link to={`/staff/users/${r.userProfileId}`} className="font-medium text-ink hover:text-brand-dark hover:underline">{r.userName}</Link>
                        </td>
                        <td className={tableCls.td}>{fmtDate(r.requestedAt)}</td>
                        <td className={tableCls.td}>{fmtDate(r.dueDate)}</td>
                        <td className={tableCls.td}><StatusBadge status={r.status} /></td>
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
                    <Link to={`/staff/users/${q.userProfileId}`} className="flex-1 font-medium hover:text-brand-dark hover:underline">{q.userName}</Link>
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
