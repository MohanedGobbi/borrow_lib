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
import { BorrowNotice } from "@/components/BorrowNotice";
import { Container } from "@/components/Layout";
import { EmptyState, PageHeader } from "@/components/Page";
import { GuardedButton } from "@/components/GuardedButton";
import { Button } from "@/components/ui/button";
import { useRequestGuard } from "@/hooks/useRequestGuard";
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
  const { reason: blocked } = useRequestGuard();

  if (listed.length > 0 && isPending) return <FullPageLoader />;

  const submit = () => send.mutate();

  return (
    <Container className="max-w-3xl">
      <PageHeader title={t("cart.title")} description={t("cart.sub")} />
      <BorrowNotice className="mt-6" />

      {items.length === 0 ? (
        <div className="mt-8 rounded-md border bg-white">
          <EmptyState icon={ClipboardList} title={t("cart.empty")}>
            <Button asChild size="sm"><Link to="/catalog">{t("cart.browse")}</Link></Button>
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y overflow-hidden rounded-md border bg-white">
            {items.map((b) => (
              <li key={b.id} className="flex items-center gap-5 p-4 sm:p-5">
                {/* a title plate this small repeats the title beside it: only a real cover earns the thumbnail */}
                {b.coverImage && <div className="w-14 shrink-0"><BookCover book={b} size="sm" /></div>}
                <div className="min-w-0 flex-1">
                  <Link to={`/books/${b.id}`} className="type-heading text-ink hover:text-brand-dark hover:underline"><bdi>{b.title}</bdi></Link>
                  <p className="mt-0.5 text-[15px] text-muted-foreground"><bdi>{b.author}</bdi></p>
                  <Availability book={b} className="mt-2" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => cart.remove(b.id)} className="text-muted-foreground hover:text-danger">
                  <X className="size-4" aria-hidden /> {t("cart.remove")}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <Button asChild variant="ghost"><Link to="/catalog">{t("cart.browse")}</Link></Button>
            <GuardedButton size="lg" disabled={busy} reason={blocked} onClick={submit}>
              {busy ? t("cart.submitting") : <>{t("cart.submit")} <span className="tabular">({items.length})</span></>}
            </GuardedButton>
          </div>
        </>
      )}
    </Container>
  );
}
