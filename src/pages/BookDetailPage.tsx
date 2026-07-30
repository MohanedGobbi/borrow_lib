import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Pencil, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";
import { apiBooks, apiRecords, apiReservations } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { useCart } from "@/cart/CartContext";
import { useI18n } from "@/i18n";
import { BookCover } from "@/components/BookCover";
import { BookEditDialog } from "@/components/BookEditDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { fmtDate } from "@/components/Countdown";

export default function BookDetailPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const cart = useCart();
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const { data: book, loading, error, refetch } = useApi(() => apiBooks.get(id!), [id]);
  const isStaff = !!me && me.role !== "MEMBER";
  const isMember = !!me && me.role === "MEMBER";

  const { data: queue, refetch: refetchQueue } = useApi(
    () => (isStaff ? apiReservations.forBook(Number(id)) : Promise.resolve([])),
    [id, me?.id]
  );
  const { data: loans } = useApi(
    () => (isStaff ? apiRecords.list({ book: Number(id) }) : Promise.resolve([])),
    [id, me?.id]
  );

  if (loading) return <FullPageLoader />;
  if (error || !book) {
    return (
      <div className="rounded-md border border-border bg-white p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("book.notFound")}</p>
        <Button asChild variant="link" className="mt-2 text-burnt"><Link to="/catalog">{t("book.back")}</Link></Button>
      </div>
    );
  }

  const out = book.availableCopies <= 0;
  const activeLoans = (loans ?? []).filter((r) =>
    ["BORROWED", "OVERDUE", "READY", "PENDING"].includes(r.status)
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refetch();
      refetchQueue();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed.");
    }
  };

  const meta: [string, string][] = [
    ["ISBN", book.isbn],
    ["Category", book.category.name],
    ["Publisher", book.publisher || "—"],
    ["Year", book.year ? String(book.year) : "—"],
    ["Shelf", book.shelfLocation || "—"],
    ["Copies", `${book.availableCopies} / ${book.totalCopies}`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="text-burnt">
          <Link to="/catalog"><ArrowLeft className="mr-1 size-4 rtl:rotate-180" /> {t("book.back")}</Link>
        </Button>
        {isStaff && (
          <Button size="sm" variant="outline" className="border-burnt text-burnt" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 size-3.5" /> {t("book.editBook")}
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <BookCover book={book} />
        <div className="rounded-md border border-border bg-white p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: book.category.color }}>
            {book.category.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{book.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("book.by")} {book.author}</p>
          {/* staff-written description */}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed">{book.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {meta.map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!me && (
              <Button asChild variant="outline" className="border-burnt text-burnt hover:bg-burnt hover:text-white">
                <Link to="/login">{t("catalog.signinBorrow")}</Link>
              </Button>
            )}
            {isMember && out && (
              <Button
                variant="outline" className="border-burnt text-burnt hover:bg-burnt hover:text-white"
                onClick={() => act(() => apiReservations.create(book.id), "Joined the reservation queue.")}
              >
                {t("book.reserve")}
              </Button>
            )}
            {isMember && !out && (
              <>
                <Button
                  className="bg-brand text-white hover:bg-brand-dark"
                  onClick={() => act(() => apiRecords.create(book.id), "Request submitted — waiting for staff approval.")}
                >
                  {t("book.borrow")}
                </Button>
                <Button
                  variant="outline" className="border-brand text-brand-dark"
                  disabled={cart.has(book.id)}
                  onClick={() => { cart.add(book.id); toast.success(`“${book.title}” — ${t("cart.title")}`); }}
                >
                  {cart.has(book.id) ? <Check className="mr-1 size-4" /> : <ShoppingCart className="mr-1 size-4" />}
                  {t("book.addCart")}
                </Button>
              </>
            )}
            {isMember && (
              <span className="font-mono text-xs text-muted-foreground">{t("book.rules")}</span>
            )}
          </div>
        </div>
      </div>

      {/* staff-only: current borrowers */}
      {isStaff && (
        <div className="rounded-md border border-border bg-cream-deep p-4">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
            {t("book.currentBorrowers")} <span className="text-muted-foreground">{t("book.staffView")}</span>
          </h2>
          {activeLoans.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("book.noLoans")}</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {activeLoans.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-white px-3 py-2">
                  <Link to={`/staff/users/${r.userProfileId}`} className="text-sm font-semibold text-burnt hover:underline">
                    {r.userName}
                  </Link>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {r.borrowedAt ? `${t("book.pickedUp")} ${fmtDate(r.borrowedAt)}` : `${t("req.requested")} ${fmtDate(r.requestedAt)}`}
                    {r.dueDate ? ` · ${t("book.due")} ${fmtDate(r.dueDate)}` : ""}
                  </span>
                  <span className="ms-auto"><StatusBadge status={r.status} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* staff-only: reservation queue */}
      {isStaff && (queue ?? []).length > 0 && (
        <div className="rounded-md border border-border bg-cream-deep p-4">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
            {t("book.queue")} <span className="text-muted-foreground">{t("book.staffView")}</span>
          </h2>
          <ol className="mt-2 space-y-1">
            {(queue ?? []).map((q) => (
              <li key={q.id} className="flex items-center gap-3 text-sm">
                <span className="flex size-5 items-center justify-center rounded-sm bg-ink font-mono text-[10px] font-bold text-white">
                  {q.position}
                </span>
                <Link to={`/staff/users/${q.userProfileId}`} className="font-medium text-burnt hover:underline">{q.userName}</Link>
                <span className="font-mono text-[11px] text-muted-foreground">{t("book.joined")} {fmtDate(q.reservedAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <BookEditDialog book={book} open={editOpen} onOpenChange={setEditOpen} onSaved={refetch} />
    </div>
  );
}
