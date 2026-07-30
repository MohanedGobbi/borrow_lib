import { Link } from "react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiBooks } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useCart } from "@/cart/CartContext";
import { useI18n } from "@/i18n";
import { BookCover } from "@/components/BookCover";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { useState } from "react";

export default function CartPage() {
  const { t } = useI18n();
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const { data: books, loading, refetch } = useApi(() => apiBooks.list(), []);
  const items = (books ?? []).filter((b) => cart.bookIds.includes(b.id));

  if (loading) return <FullPageLoader />;

  const submit = async () => {
    setBusy(true);
    const { ok, failed } = await cart.submitAll();
    if (ok > 0) toast.success(`${ok} request(s) submitted — waiting for staff approval.`);
    failed.forEach((f) => toast.error(f));
    setBusy(false);
    refetch();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-burnt">{t("nav.cart")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{t("cart.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{items.length} {t("cart.items")}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("cart.empty")}</p>
          <Button asChild className="mt-3 bg-brand text-white hover:bg-brand-dark">
            <Link to="/catalog">{t("cart.browse")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((b) => (
              <div key={b.id} className="flex items-center gap-4 rounded-md border border-border bg-white p-3">
                <div className="w-14 shrink-0"><BookCover book={b} /></div>
                <div className="min-w-0 flex-1">
                  <Link to={`/books/${b.id}`} className="text-sm font-semibold hover:text-burnt">{b.title}</Link>
                  <p className="text-xs text-muted-foreground">{b.author}</p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider">
                    {b.availableCopies > 0
                      ? <span className="text-success">{b.availableCopies} {t("catalog.available")}</span>
                      : <span className="text-danger">0 {t("catalog.available")}</span>}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => cart.remove(b.id)} aria-label={t("cart.remove")}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="w-full bg-burnt py-6 text-base text-white hover:bg-burnt-dark"
            disabled={busy || items.length === 0}
            onClick={submit}
          >
            {busy ? t("cart.submitting") : `${t("cart.submit")} (${items.length})`}
          </Button>
        </>
      )}
    </div>
  );
}
