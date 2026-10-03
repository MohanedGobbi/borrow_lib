import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { useLandingMotion } from "@/hooks/useLandingMotion";
import { apiBooks } from "@/api";
import { qk } from "@/api/queryKeys";
import { useHeroHeader } from "@/lib/heroHeader";
import { BookCover } from "@/components/BookCover";
import { Availability } from "@/components/BookActions";
import { SitePhoto } from "@/components/SitePhoto";
import { Button } from "@/components/ui/button";

const SECTION = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export default function LandingPage() {
  const { me } = useAuth();
  const { t, dir } = useI18n();
  const ruleVars = useRuleVars();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  useHeroHeader(heroRef);
  useLandingMotion(rootRef, dir === "rtl");

  const shelfParams = { available: true, pageSize: 6 };
  const { data: shelf } = useQuery({ queryKey: qk.books.list(shelfParams), queryFn: () => apiBooks.list(shelfParams) });
  const onShelf = shelf?.results ?? [];
  // Without cover photographs the shelf is set as type, not as empty boxes that repeat the caption beneath them.
  const typeShelf = onShelf.every((b) => !b.coverImage);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  };

  const steps = [1, 2, 3, 4].map((n) => ({ n, title: t(`step${n}.title`, ruleVars), body: t(`step${n}.body`) }));
  const facts: [string, string][] = [
    [t("landing.factHold"), ruleVars.hours],
    [t("landing.factLoan"), t("landing.factLoanValue", ruleVars)],
    [t("landing.factQueue"), t("landing.factQueueValue")],
    [t("landing.factLate"), t("landing.factLateValue")],
  ];
  const isStaff = !!me && me.role !== "MEMBER";

  return (
    <div ref={rootRef}>
      {/* First viewport: the photograph, one headline, one search. The header lies over it. */}
      <section
        ref={heroRef}
        className="relative isolate flex h-[100svh] max-h-[60rem] min-h-[36rem] items-end overflow-hidden bg-ink text-white"
      >
        <SitePhoto slot="hero" priority sizes="100vw" className="hero-photo absolute inset-0 -z-20 size-full object-cover" />
        <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />

        <div className={`${SECTION} pb-[clamp(3.5rem,12vh,8rem)] pt-28`}>
          <h1 className="type-hero hero-settle max-w-[10.5em] text-white">{t("landing.title")}</h1>
          <p className="hero-settle mt-6 max-w-[34rem] text-[17px] leading-relaxed text-white/85 [animation-delay:90ms] sm:text-lg">
            {t("landing.sub")}
          </p>

          <form onSubmit={search} role="search" className="hero-settle mt-10 max-w-[40rem] [animation-delay:180ms]">
            <label htmlFor="hero-search" className="sr-only">{t("landing.searchLabel")}</label>
            <div className="flex h-[3.75rem] items-center rounded-lg bg-white p-1.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)] transition-shadow focus-within:outline focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-white">
              <Search className="ms-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                id="hero-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("landing.searchPlaceholder")}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-muted-foreground focus-visible:outline-none sm:text-[17px]"
              />
              <Button type="submit" className="h-12 rounded-md px-5 sm:px-7">{t("landing.search")}</Button>
            </div>
          </form>
        </div>
      </section>

      {/* How borrowing works: the dense passage. The line between the steps draws as it scrolls in. */}
      <section aria-labelledby="how-title" className={`${SECTION} py-24 lg:py-32`}>
        <div className="grid gap-x-12 gap-y-6 lg:grid-cols-12 lg:items-end">
          <h2 id="how-title" className="type-display text-ink lg:col-span-6">{t("landing.how")}</h2>
          <p className="max-w-xl text-lead text-muted-foreground lg:col-span-5 lg:col-start-8">{t("landing.howLead")}</p>
        </div>

        <ol data-steps className="mt-16 grid gap-10 md:mt-20 md:grid-cols-4 md:gap-8">
          {steps.map((s, i) => (
            <li key={s.n} data-step data-lit="true" className="group relative ps-14 md:ps-0 md:pt-14">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute start-4 top-10 -bottom-8 w-px bg-border md:start-11 md:top-4 md:bottom-auto md:h-px md:w-[calc(100%-1.5rem)]"
                >
                  <span data-step-fill className="absolute inset-0 bg-brand" />
                </span>
              )}
              <span
                aria-hidden
                className="absolute start-0 top-0 flex size-8 items-center justify-center rounded-full border border-border bg-white font-display text-[15px] font-semibold text-muted-foreground transition-colors duration-500 group-data-[lit=true]:border-brand group-data-[lit=true]:bg-brand group-data-[lit=true]:text-white"
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-[17px] font-semibold leading-snug text-ink">{s.title}</h3>
                <p className="mt-2.5 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Real books, straight from the catalog. */}
      {onShelf.length > 0 && (
        <section aria-labelledby="shelf-title" className="border-y bg-surface">
          <div className={`${SECTION} py-20 lg:py-24`}>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <h2 id="shelf-title" className="type-display text-ink">{t("landing.available")}</h2>
              <Link to="/catalog?available=1" className="link-arrow text-[15px]">
                {t("landing.viewCatalog")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
            {typeShelf ? (
              <ul className="mt-12 grid gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-14">
                {onShelf.map((b) => (
                  <li key={b.id} className="border-t border-ink/70">
                    <Link to={`/books/${b.id}`} className="group block rounded-sm py-6 lg:py-7">
                      <span dir="auto" className="block font-display text-[1.375rem] font-semibold leading-snug text-ink group-hover:underline sm:text-[1.5rem]">
                        {b.title}
                      </span>
                      <span dir="auto" className="mt-1.5 block text-[15px] text-muted-foreground">{b.author}</span>
                      <Availability book={b} className="mt-4 text-[13px]" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
            <ul className="scrollbar-none -mx-4 mt-12 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 sm:overflow-visible sm:px-0 lg:grid-cols-6 lg:gap-x-8">
              {onShelf.map((b) => (
                <li key={b.id} className="w-[42%] shrink-0 snap-start sm:w-auto">
                  <Link to={`/books/${b.id}`} className="group block rounded-sm">
                    <BookCover
                      book={b}
                      size="lg"
                      className="transition-[transform,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:border-ink/40"
                    />
                    <span dir="auto" className="mt-4 line-clamp-2 font-display text-[17px] font-semibold leading-snug text-ink group-hover:underline">
                      {b.title}
                    </span>
                    <span dir="auto" className="mt-1 line-clamp-1 text-sm text-muted-foreground">{b.author}</span>
                  </Link>
                  <Availability book={b} className="mt-2.5 text-[13px]" />
                </li>
              ))}
            </ul>
            )}
          </div>
        </section>
      )}

      {/* The feature: a quiet photograph and the one rule that makes borrowing fair. */}
      <section aria-labelledby="feature-title" className="grid lg:min-h-[44rem] lg:grid-cols-12">
        <div data-parallax-frame className="relative aspect-[4/3] overflow-hidden bg-ink sm:aspect-[16/9] lg:col-span-7 lg:aspect-auto">
          <SitePhoto
            slot="feature"
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="absolute inset-x-0 -top-[7%] h-[114%] w-full object-cover"
          />
        </div>
        <div className="flex items-center px-4 py-16 sm:px-6 lg:col-span-5 lg:px-14 lg:py-24 xl:px-20">
          <div className="max-w-xl">
            <h2 id="feature-title" className="type-display text-ink">{t("landing.featureTitle")}</h2>
            <p className="mt-6 text-lead text-muted-foreground">{t("landing.featureBody", ruleVars)}</p>
            <dl className="mt-10 border-t text-[15px]">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-6 border-b py-3.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* The close: students to the catalog, staff to the desk. The quiet passage. */}
      <section aria-labelledby="close-title" className={`${SECTION} py-24 lg:py-32`}>
        <h2 id="close-title" className="type-display max-w-[18ch] text-ink">{t("landing.closeTitle")}</h2>
        <div className="mt-14 grid border-t md:grid-cols-2">
          <div className="py-10 md:border-e md:pe-12">
            <h3 className="text-[17px] font-semibold text-ink">{t("landing.closeStudents")}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{t("landing.closeStudentsBody")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild size="lg" className="h-12"><Link to="/catalog">{t("landing.browseCatalog")}</Link></Button>
              {!me && (
                <Link to="/signup" className="text-[15px] font-medium text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
                  {t("landing.createAccount")}
                </Link>
              )}
            </div>
          </div>
          <div className="border-t py-10 md:border-t-0 md:ps-12">
            <h3 className="text-[17px] font-semibold text-ink">{t("landing.staffTitle")}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{t("landing.staffBody")}</p>
            <Link to={isStaff ? "/staff" : "/login"} className="link-arrow mt-8 text-[15px]">
              {isStaff ? t("landing.staffDesk") : t("landing.staffSignin")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
