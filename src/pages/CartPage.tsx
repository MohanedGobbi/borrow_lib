import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { apiBooks } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useCart } from "@/cart/CartContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { BookCover } from "@/components/BookCover";
import { Availability } from "@/components/BookActions";
import { Container } from "@/components/Layout";
import { EmptyState, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";

export default function CartPage() {
  const { t } = useI18n();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const { data: books, loading, refetch } = useApi(
    () => (cart.bookIds.length ? apiBooks.list({ ids: cart.bookIds, pageSize: 100 }) : Promise.resolve(null)),
    [],
  );
  const items = (books?.results ?? []).filter((b) => cart.bookIds.includes(b.id));

  if (loading) return <FullPageLoader />;

  const submit = async () => {
    setBusy(true);
    const { ok, failed } = await cart.submitAll();
    if (ok > 0) toast.success(t("toast.cartSent", { n: ok }));
    failed.forEach((f) => toast.error(errorMessage(t, f)));
    setBusy(false);
    refetch();
  };

  return (
    <Container className="max-w-3xl">
      <PageHeader title={t("cart.title")} description={t("cart.sub")} />

      {items.length === 0 ? (
        <div className="mt-8 rounded-md border">
          <EmptyState icon={ClipboardList} title={t("cart.empty")}>
            <Button asChild size="sm"><Link to="/catalog">{t("cart.browse")}</Link></Button>
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y rounded-md border bg-white">
            {items.map((b) => (
              <li key={b.id} className="flex items-center gap-4 p-4">
                <div className="w-12 shrink-0"><BookCover book={b} size="sm" /></div>
                <div className="min-w-0 flex-1">
                  <Link to={`/books/${b.id}`} className="font-semibold text-ink hover:text-brand-dark hover:underline">{b.title}</Link>
                  <p className="text-sm text-muted-foreground">{b.author}</p>
                  <Availability book={b} className="mt-1" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => cart.remove(b.id)} className="text-muted-foreground hover:text-danger">
                  <X className="size-4" aria-hidden /> {t("cart.remove")}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Button asChild variant="ghost"><Link to="/catalog">{t("cart.browse")}</Link></Button>
            <Button size="lg" disabled={busy} onClick={submit}>
              {busy ? t("cart.submitting") : <>{t("cart.submit")} <span className="tabular">({items.length})</span></>}
            </Button>
          </div>
        </>
      )}
    </Container>
  );
}
