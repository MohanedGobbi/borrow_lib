import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, BookOpen, Clock, MapPin, Search, Scale } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { apiBooks } from "@/api";
import { qk } from "@/api/queryKeys";
import { SitePhoto } from "@/components/SitePhoto";
import { Seal } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";

const SECTION = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/**
 * The front door, set like the faculty's own banner: both seals and the names, the faculty building, and
 * straight under it the two things a visitor comes for: searching the catalogue and signing in.
 */
export default function LandingPage() {
  const { me } = useAuth();
  const { t, dir } = useI18n();
  const ruleVars = useRuleVars();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const countParams = { pageSize: 1 };
  const { data: catalogue } = useQuery({ queryKey: qk.books.list(countParams), queryFn: () => apiBooks.list(countParams) });

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  };

  const Forward = dir === "rtl" ? ArrowLeft : ArrowRight;
  const isStaff = !!me && me.role !== "MEMBER";
  const facts = [
    { icon: BookOpen, label: t("landing.factTitles"), value: catalogue ? String(catalogue.count) : "—" },
    { icon: Clock, label: t("landing.factHold"), value: ruleVars.hours },
    { icon: Scale, label: t("landing.factLoan"), value: ruleVars.days },
  ];

  return (
    <div>
      {/* The banner: both seals, the university, the faculty, the library. */}
      <section aria-labelledby="landing-title" className="border-b bg-[linear-gradient(180deg,#F7F5EF_0%,#FFFFFF_100%)]">
        <div className={`${SECTION} pb-10 pt-10 sm:pt-14`}>
          {/* As on the faculty's banner: in Arabic the faculty's seal stands on the right, the university's on the left. */}
          <div className="flex items-start justify-between gap-3 sm:gap-6">
            <Seal which="faculty" className="h-12 sm:h-[72px]" />
            <div className="min-w-0 flex-1 text-center">
              <p className="font-display text-lg font-semibold text-brand-dark sm:text-xl">{t("brand.university")}</p>
              <span aria-hidden className="mx-auto mt-3 block h-px w-32 bg-[#B8975A]/60" />
              <h1 id="landing-title" className="type-display mt-4 text-ink max-sm:text-[1.75rem]">{t("brand.faculty")}</h1>
              <p className="mt-3 text-lead text-muted-foreground">{t("landing.libraryLine")}</p>
            </div>
            <Seal which="university" className="h-12 sm:h-[72px]" />
          </div>
        </div>
      </section>

      <section aria-label={t("landing.searchLabel")} className={`${SECTION} py-10 lg:py-14`}>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <figure className="overflow-hidden rounded-md border bg-surface">
            <SitePhoto slot="hero" priority sizes="(min-width: 1024px) 640px, 100vw" className="aspect-[4/3] w-full object-cover" />
          </figure>

          <div>
            <h2 className="type-title text-ink">{t("landing.title")}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{t("landing.lead", ruleVars)}</p>

            <form onSubmit={search} role="search" className="mt-7">
              <label htmlFor="hero-search" className="sr-only">{t("landing.searchLabel")}</label>
              <div className="flex h-14 items-center rounded-md border border-input bg-white p-1.5 focus-within:border-brand focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand/30">
                <Search className="ms-2.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("landing.searchPlaceholder")}
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-muted-foreground focus-visible:outline-none"
                />
                <Button type="submit" className="h-11 px-5">{t("landing.search")}</Button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              {me ? (
                <Button asChild size="lg" className="h-12">
                  <Link to={isStaff ? "/staff" : "/my-requests"}>
                    {isStaff ? t("landing.staffDesk") : t("nav.myRequests")} <Forward className="size-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="h-12"><Link to="/login">{t("nav.signin")}</Link></Button>
                  <Button asChild size="lg" variant="outline" className="h-12"><Link to="/signup">{t("nav.join")}</Link></Button>
                </>
              )}
              <Button asChild size="lg" variant="ghost" className="h-12">
                <Link to="/catalog">{t("landing.browseCatalog")}</Link>
              </Button>
            </div>

            <dl className="mt-8 grid grid-cols-3 border-y">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="border-e px-3 py-4 first:ps-0 last:border-e-0">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5 shrink-0" aria-hidden /> {label}
                  </dt>
                  <dd className="tabular mt-1.5 font-display text-lg font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* The faculty's motto and where to find the library. */}
      <section className="bg-brand-dark text-white">
        <div className={`${SECTION} flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-between sm:text-start`}>
          <p className="font-display text-lg font-semibold">{t("landing.motto")}</p>
          <p className="flex items-center gap-2 text-sm text-white/80">
            <MapPin className="size-4 shrink-0" aria-hidden /> {t("footer.address")}
          </p>
        </div>
      </section>
    </div>
  );
}
