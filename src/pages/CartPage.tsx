import { useState } from "react";
import { Link } from "react-router";
import { ClipboardList, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiBooks } from "@/api";
import { invalidateCirculation, qk } from "@/api/queryKeys";
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
  const qc = useQueryClient();
  // The books are looked up once for the list as it was when the page opened; removing one just hides it.
  const [listed] = useState(cart.bookIds);
  const listParams = { ids: listed, pageSize: 100 };
  const { data: books, isPending } = useQuery({
    queryKey: qk.books.list(listParams),
    queryFn: () => apiBooks.list(listParams),
    enabled: listed.length > 0,
  });
  const items = (books?.results ?? []).filter((b) => cart.bookIds.includes(b.id));

  const send = useMutation({
    mutationFn: () => cart.submitAll(),
    onSuccess: ({ ok, failed }) => {
      if (ok > 0) toast.success(t("toast.cartSent", { n: ok }));
      failed.forEach((f) => toast.error(errorMessage(t, f)));
      return invalidateCirculation(qc);
    },
  });
  const busy = send.isPending;

  if (listed.length > 0 && isPending) return <FullPageLoader />;

  const submit = () => send.mutate();

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
                  <Link dir="auto" to={`/books/${b.id}`} className="font-semibold text-ink hover:text-brand-dark hover:underline">{b.title}</Link>
                  <p dir="auto" className="text-sm text-muted-foreground">{b.author}</p>
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
