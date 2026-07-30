import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Pencil, Search, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";
import { apiBooks, apiCategories, apiRecords, apiReservations } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { useCart } from "@/cart/CartContext";
import { useI18n } from "@/i18n";
import { useCategoryAccent } from "@/hooks/useCategoryAccent";
import { BookCover } from "@/components/BookCover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function CatalogPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { data: categories } = useApi(() => apiCategories.list(), []);
  const { data: books, loading, error, refetch } = useApi(
    () => apiBooks.list(category === "All" ? {} : { category }),
    [category]
  );

  const activeColor = category === "All"
    ? null
    : (categories ?? []).find((c) => c.name === category)?.color;
  useCategoryAccent(activeColor);

  const isStaff = !!me && me.role !== "MEMBER";
  const isMember = !!me && me.role === "MEMBER";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (books ?? []).filter(
      (b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.toLowerCase().includes(q)
    );
  }, [books, search]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* hero follows the active category color */}
      <div
        className="rounded-md px-6 py-8 text-white transition-colors duration-500"
        style={{ backgroundColor: activeColor ?? "#C55221" }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-80">{t("catalog.heroKicker")}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {t("catalog.heroTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-sm opacity-90">{t("catalog.heroSub")}</p>
        {isStaff && (
          <p className="mt-3 inline-block rounded-sm bg-white/15 px-2 py-1 font-mono text-[11px] uppercase tracking-widest">
            {t("catalog.staffNote")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("catalog.search")}
            className="bg-white ps-8"
            aria-label={t("catalog.search")}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px] bg-white" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">{t("catalog.all")}</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.name}>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} {t("catalog.titles")}
        </span>
      </div>

      {loading && <FullPageLoader />}
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-6 py-10 text-center text-sm text-danger">
          {t("common.apiDown")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((b) => {
          const out = b.availableCopies <= 0;
          return (
            <article key={b.id} className="flex flex-col rounded-md border border-border bg-white p-3">
              <Link to={`/books/${b.id}`} className="focus-visible:outline-2 focus-visible:outline-brand">
                <BookCover book={b} />
              </Link>
              <div className="mt-3 flex-1">
                <Link to={`/books/${b.id}`} className="text-sm font-semibold leading-snug hover:text-burnt focus-visible:outline-2 focus-visible:outline-brand">
                  {b.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{b.author}</p>
                <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider">
                  {out ? (
                    <span className="text-danger">0 {t("catalog.available")}</span>
                  ) : (
                    <span className="text-success">{b.availableCopies}/{b.totalCopies} {t("catalog.available")}</span>
                  )}
                </p>
              </div>

              <div className="mt-3 space-y-1.5">
                {/* staff variant: stock + edit instead of borrow */}
                {isStaff && (
                  <>
                    <p className="rounded-sm bg-cream px-2 py-1 text-center font-mono text-[11px]">
                      {b.availableCopies} / {b.totalCopies} {t("catalog.inLibrary")}
                    </p>
                    <Button asChild size="sm" variant="outline" className="w-full border-burnt text-burnt hover:bg-burnt hover:text-white">
                      <Link to={`/books/${b.id}`}><Pencil className="mr-1 size-3.5" /> {t("catalog.edit")}</Link>
                    </Button>
                  </>
                )}

                {!me && (
                  <Button asChild size="sm" variant="outline" className="w-full border-burnt text-burnt hover:bg-burnt hover:text-white">
                    <Link to="/login">{t("catalog.signinBorrow")}</Link>
                  </Button>
                )}

                {isMember && out && (
                  <Button
                    variant="outline" size="sm"
                    className="w-full border-burnt text-burnt hover:bg-burnt hover:text-white"
                    onClick={() => act(() => apiReservations.create(b.id), "Joined the reservation queue.")}
                  >
                    {t("catalog.reserve")}
                  </Button>
                )}

                {isMember && !out && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm" className="flex-1 bg-brand text-white hover:bg-brand-dark"
                      style={{ backgroundColor: activeColor ?? undefined }}
                      onClick={() => act(() => apiRecords.create(b.id), "Request submitted — waiting for staff approval.")}
                    >
                      {t("catalog.borrow")}
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="border-brand text-brand-dark hover:bg-brand hover:text-white"
                      aria-label={t("catalog.addCart")}
                      disabled={cart.has(b.id)}
                      onClick={() => { cart.add(b.id); toast.success(`“${b.title}” — ${t("cart.title")}`); }}
                    >
                      {cart.has(b.id) ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-white px-6 py-12 text-center text-sm text-muted-foreground">
          {t("catalog.noMatch")}
        </div>
      )}
    </div>
  );
}
