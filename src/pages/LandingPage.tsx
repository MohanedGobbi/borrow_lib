import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { useApi } from "@/hooks/useApi";
import { apiBooks } from "@/api";
import { BookCover } from "@/components/BookCover";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: shelf } = useApi(() => apiBooks.list({ available: true, pageSize: 6 }), []);
  const onShelf = shelf?.results ?? [];

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  };

  const steps = [1, 2, 3, 4].map((n) => ({ n, title: t(`step${n}.title`), body: t(`step${n}.body`) }));

  return (
    <>
      <section className="border-b bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:py-20">
          <div className="max-w-2xl self-center">
            <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-[2.6rem]">
              {t("landing.title")}
            </h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{t("landing.sub")}</p>

            <form onSubmit={search} role="search" className="mt-8">
              <label htmlFor="hero-search" className="text-sm font-medium text-ink">{t("landing.searchLabel")}</label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="hero-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("landing.searchPlaceholder")}
                    className="h-12 w-full rounded-md border border-input bg-white ps-11 pe-3 text-base shadow-[0_1px_2px_rgb(16_24_20/0.05)] placeholder:text-muted-foreground/80 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20"
                  />
                </div>
                <Button type="submit" size="lg" className="h-12">{t("landing.search")}</Button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
              <Link to="/catalog" className="inline-flex items-center gap-1.5 font-medium text-brand-dark hover:underline">
                {t("landing.browseAll")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
              {!me && (
                <Link to="/signup" className="font-medium text-ink/80 hover:text-ink hover:underline">
                  {t("landing.createAccount")}
                </Link>
              )}
            </div>
          </div>

          <aside className="rounded-md border bg-white p-6 shadow-[0_1px_3px_rgb(16_24_20/0.06)]" aria-labelledby="how-title">
            <h2 id="how-title" className="text-base font-semibold text-ink">{t("landing.how")}</h2>
            <ol className="mt-5 space-y-5">
              {steps.map((s) => (
                <li key={s.n} className="grid grid-cols-[2rem_1fr] gap-3">
                  <span className="tabular flex size-8 items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-sm font-semibold text-brand-dark">
                    {s.n}
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      {onShelf.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{t("landing.available")}</h2>
            <Link to="/catalog?available=1" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-brand-dark hover:underline">
              {t("landing.viewCatalog")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {onShelf.map((b) => (
              <li key={b.id}>
                <Link to={`/books/${b.id}`} className="group block rounded-md">
                  <BookCover book={b} size="lg" className="transition-shadow group-hover:shadow-[0_6px_16px_rgb(16_24_20/0.18)]" />
                  <span className="mt-3 block text-[15px] font-semibold leading-snug text-ink group-hover:text-brand-dark group-hover:underline line-clamp-2">
                    {b.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-1">{b.author}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold">{t("landing.staffTitle")}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("landing.staffBody")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/login">{t("landing.staffSignin")}</Link></Button>
            <Button asChild variant="ghost"><Link to="/signup?role=staff">{t("landing.staffRegister")}</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
