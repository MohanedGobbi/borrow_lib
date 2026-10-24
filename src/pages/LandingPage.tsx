import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowDown, ArrowLeft, ArrowRight, Clock, MapPin, Pause, Play, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { useReducedMotion, useSmoothScroll } from "@/hooks/useSmoothScroll";
import { apiBooks, apiCategories } from "@/api";
import { qk } from "@/api/queryKeys";
import { SitePhoto } from "@/components/SitePhoto";
import { Seal } from "@/components/Wordmark";
import { Availability } from "@/components/BookActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Book, Category } from "@/types";

const AisleScene = lazy(() => import("@/pages/landing/AisleScene"));

/** One stop on the walk: a full viewport, so each section meets the camera at its own arch. */
const STATION = "relative flex min-h-[100svh] items-center px-4 py-24 sm:px-6 lg:px-8";
/** The plaques the text is set on: white, a gold hairline, a soft offset shadow. */
const PLAQUE = "rounded-md border border-[#B8975A]/50 bg-white/[0.97] shadow-[0_28px_64px_-28px_rgb(18_26_22/0.35)]";
const SHELF_SAMPLE = 12;

/**
 * The front door: a walk down the library's arcade. The first arch carries the banner (both seals and the
 * names) and the catalogue search; each section after it is one more arch: how a loan works, the subjects on
 * the shelves, books on the shelf now, and when the desk is open.
 */
export default function LandingPage() {
  const reduced = useReducedMotion();
  const lenis = useSmoothScroll(!reduced);
  const track = useRef<HTMLElement>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const { data: catalogue } = useQuery({ queryKey: qk.books.list({ pageSize: 1 }), queryFn: () => apiBooks.list({ pageSize: 1 }) });
  const { data: onShelf } = useQuery({
    queryKey: qk.books.list({ pageSize: 1, available: true }),
    queryFn: () => apiBooks.list({ pageSize: 1, available: true }),
  });
  // A different stretch of the shelf on each visit: one random page of the books with a free copy.
  const [pick] = useState(() => Math.random());
  const pages = onShelf ? Math.max(1, Math.ceil(onShelf.count / SHELF_SAMPLE)) : 0;
  const page = pages ? 1 + Math.floor(pick * pages) : 0;
  const shelfParams = { pageSize: SHELF_SAMPLE, available: true, page };
  const { data: shelf } = useQuery({
    queryKey: qk.books.list(shelfParams),
    queryFn: () => apiBooks.list(shelfParams),
    enabled: page > 0,
  });
  const books = shelf?.results ?? [];
  const colors = books.map((b) => b.coverColor).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const { data: categories, isPending: subjectsPending } = useQuery({ queryKey: qk.categories.all, queryFn: apiCategories.list });
  const subjects = [...(categories ?? [])].filter((c) => (c.bookCount ?? 0) > 0).sort((a, b) => (b.bookCount ?? 0) - (a.bookCount ?? 0));
  // One subject per bay sign in the arcade; the scene re-letters its plates only when the list itself changes.
  const signs = useMemo(() => (categories ?? []).filter((c) => (c.bookCount ?? 0) > 0)
    .sort((a, b) => (b.bookCount ?? 0) - (a.bookCount ?? 0)).slice(0, 14).map((c) => c.name), [categories]);

  const walkOn = () => {
    const next = document.getElementById("landing-loans");
    if (!next) return;
    if (lenis.current) lenis.current.scrollTo(next, { offset: 0, duration: 1.8 });
    else next.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section ref={track} aria-labelledby="landing-title" className="relative isolate -mt-16 bg-[#F7F8F6]">
      {/* The arcade, held in place while the sections scroll over it. */}
      <div className="sticky top-0 -z-10 h-[100svh] overflow-hidden" aria-hidden>
        <div className="aisle-placeholder absolute inset-0" />
        <div className={cn("absolute inset-0 transition-opacity duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]", sceneReady ? "opacity-100" : "opacity-0")}>
          <Suspense fallback={null}>
            <AisleScene track={track} colors={colors} subjects={signs} still={reduced} onReady={() => setSceneReady(true)} />
          </Suspense>
        </div>
      </div>

      <div className="-mt-[100svh]">
        <Arrival count={catalogue?.count} onWalk={walkOn} />
        <Loans />
        <Subjects total={catalogue?.count} subjects={subjects.slice(0, 8)} pending={subjectsPending} />
        <OnTheShelf books={books} still={reduced} />
        <Visit />
      </div>
    </section>
  );
}

/** The first arch: the banner as on the faculty's own, then the search and the way in. */
function Arrival({ count, onWalk }: { count?: number; onWalk: () => void }) {
  const { me } = useAuth();
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const isStaff = !!me && me.role !== "MEMBER";
  const Forward = dir === "rtl" ? ArrowLeft : ArrowRight;

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  };

  return (
    <div className={cn(STATION, "justify-center pt-28")}>
      <div aria-hidden className="arrival-scrim pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-3xl text-center">
        {/*
          The banner's lockup: the university, the gold rule, the faculty, set as one title with the seals on
          either side. As on the faculty's banner, in Arabic the faculty's seal stands on the right.
        */}
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          <Seal which="faculty" className="h-12 sm:h-[72px]" />
          <h1 id="landing-title" className="min-w-0 text-ink">
            <span className="block font-display text-[clamp(1.5rem,1rem+1.6vw,2.5rem)] font-medium leading-tight">{t("brand.university")}</span>
            <span aria-hidden className="mx-auto my-4 block h-px w-28 bg-[#B8975A]/70 sm:w-36" />
            <span className="type-display landing-display block">{t("brand.faculty")}</span>
          </h1>
          <Seal which="university" className="h-12 sm:h-[72px]" />
        </div>
        {/* Measured to stay inside the first arch's opening, clear of the stacks behind it. */}
        <p className="mx-auto mt-6 max-w-md text-lead text-ink/80">{t("landing.libraryLine")}</p>

        <form onSubmit={search} role="search" className="mx-auto mt-9 max-w-2xl">
          <label htmlFor="hero-search" className="sr-only">{t("landing.searchLabel")}</label>
          <div className="flex h-16 items-center rounded-md border border-ink/15 bg-white p-2 shadow-[0_22px_48px_-22px_rgb(14_107_60/0.45)] transition-[border-color,box-shadow] duration-300 focus-within:border-brand focus-within:shadow-[0_22px_48px_-18px_rgb(14_107_60/0.55)]">
            <Search className="ms-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="hero-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("landing.searchPlaceholder")}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-ink placeholder:text-ink/55 focus-visible:outline-none sm:px-3 sm:text-[17px]"
            />
            <Button type="submit" className="h-12 px-4 text-[15px] sm:px-6">{t("landing.search")}</Button>
          </div>
        </form>
        {count !== undefined && (
          <p className="mt-3 text-sm text-ink/70">
            {t("landing.searchCount", { count: count.toLocaleString() })}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {me ? (
            <Button asChild size="lg" className="h-12">
              <Link to={isStaff ? "/staff" : "/my-requests"}>
                {isStaff ? t("landing.staffDesk") : t("nav.myRequests")} <Forward className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="h-12"><Link to="/login">{t("nav.signin")}</Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 bg-white/90"><Link to="/signup">{t("nav.join")}</Link></Button>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onWalk}
        className="absolute bottom-7 start-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-ink/80 shadow-[0_8px_24px_-12px_rgb(18_26_22/0.4)] transition-colors hover:bg-white hover:text-ink rtl:translate-x-1/2"
      >
        {t("landing.walkIn")} <ArrowDown className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** The second arch: the four steps of a loan, with the library's current numbers. */
function Loans() {
  const { t } = useI18n();
  const ruleVars = useRuleVars();
  const steps = ["request", "hold", "pickup", "return"] as const;
  return (
    <div id="landing-loans" className={cn(STATION, "justify-center")}>
      <div className={cn(PLAQUE, "w-full max-w-[37.5rem] p-6 sm:p-9")}>
        <h2 className="type-title text-ink">{t("landing.loansTitle")}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{t("landing.lead", ruleVars)}</p>
        <ol className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {steps.map((step, i) => (
            <li key={step} className="border-t border-[#B8975A]/40 pt-5">
              <div className="flex items-baseline gap-3">
                <span className="tabular font-display text-[2rem] font-normal leading-none text-brand">{(i + 1).toLocaleString()}</span>
                <h3 className="type-heading text-ink">{t(`landing.step.${step}`)}</h3>
              </div>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground">{t(`landing.step.${step}Body`, ruleVars)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The third arch: the directory board of the subjects on the shelves, each a link into the catalogue. */
function Subjects({ total, subjects, pending }: { total?: number; subjects: Category[]; pending: boolean }) {
  const { t, dir } = useI18n();
  const Forward = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className={cn(STATION, "justify-center")}>
      <div className={cn(PLAQUE, "w-full max-w-xl p-6 sm:p-9")}>
        <h2 className="type-title text-ink">{t("landing.subjectsTitle")}</h2>
        {total !== undefined && (
          <p className="mt-2 text-[15px] text-muted-foreground">{t("landing.subjectsLead", { count: total.toLocaleString() })}</p>
        )}
        <ul className="mt-7 divide-y divide-[#B8975A]/30 border-y border-[#B8975A]/30">
          {pending
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex h-12 items-center">
                  <span className="h-3 w-40 rounded bg-surface" />
                </li>
              ))
            : subjects.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/catalog?category=${encodeURIComponent(c.name)}`}
                    className="group flex h-12 items-center gap-3 text-[15px] text-ink transition-colors hover:text-brand-dark"
                  >
                    <span dir="auto" className="min-w-0 truncate font-medium group-hover:underline">{c.name}</span>
                    <span aria-hidden className="mx-1 h-px flex-1 border-b border-dotted border-ink/25" />
                    <span className="tabular shrink-0 text-muted-foreground">{(c.bookCount ?? 0).toLocaleString()}</span>
                  </Link>
                </li>
              ))}
        </ul>
        <Link to="/catalog" className="link-arrow mt-6 text-[15px]">
          {t("landing.browseCatalog")} <Forward className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/**
 * The fourth arch: books with a free copy right now. The plaque turns from one title to the next, line by
 * line, like a board being updated; it can be paused, and it stands still for reduced motion.
 */
function OnTheShelf({ books, still }: { books: Book[]; still: boolean }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const turning = !still && !paused && !hovered && books.length > 1;

  useEffect(() => {
    if (!turning) return;
    const id = window.setInterval(() => {
      const lines = board.current?.querySelectorAll("[data-line]");
      if (!lines?.length) return setIndex((i) => (i + 1) % books.length);
      // A slow frame rate must never leave a title half turned: finish the last change before the next.
      gsap.killTweensOf(lines);
      gsap.set(lines, { clearProps: "clipPath,transform" });
      gsap.to(lines, {
        clipPath: "inset(0% 0% 100% 0%)", yPercent: -30, duration: 0.42, ease: "power3.in", stagger: 0.07,
        onComplete: () => setIndex((i) => (i + 1) % books.length),
      });
    }, 4200);
    return () => window.clearInterval(id);
  }, [turning, books.length]);

  // Each new title rises into place, one line after the other.
  useEffect(() => {
    const lines = board.current?.querySelectorAll("[data-line]");
    if (!lines?.length || still) return;
    const tween = gsap.fromTo(lines,
      { clipPath: "inset(100% 0% 0% 0%)", yPercent: 30 },
      { clipPath: "inset(0% 0% 0% 0%)", yPercent: 0, duration: 0.7, ease: "expo.out", stagger: 0.08, clearProps: "clipPath,transform" });
    return () => {
      tween.progress(1).kill();
    };
  }, [index, still]);

  const book = books[index % Math.max(1, books.length)];
  const others = books.filter((b) => b.id !== book?.id).slice(0, 5);

  return (
    <div className={cn(STATION, "justify-center")}>
      <div
        className={cn(PLAQUE, "w-full max-w-xl p-6 sm:p-9")}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="type-title text-ink">{t("landing.shelfTitle")}</h2>
          {!still && books.length > 1 && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border text-ink/70 transition-colors hover:bg-surface hover:text-ink"
              aria-label={paused ? t("landing.shelfPlay") : t("landing.shelfPause")}
            >
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </button>
          )}
        </div>
        <p className="mt-2 text-[15px] text-muted-foreground">{t("landing.shelfLead")}</p>

        <div ref={board} className="mt-7 min-h-[11.5rem] border-y border-[#B8975A]/30 py-6">
          {book ? (
            <Link to={`/books/${book.id}`} className="group block">
              <span data-line className="block font-mono text-[13px] text-brand-dark"><bdi dir="ltr">{book.shelfLocation || "—"}</bdi></span>
              <span data-line dir="auto" className="type-feature mt-2 line-clamp-2 block text-ink group-hover:underline">{book.title}</span>
              <span data-line dir="auto" className="mt-2 block truncate text-[15px] text-muted-foreground">{book.author}</span>
              <span data-line className="mt-3 block"><Availability book={book} /></span>
            </Link>
          ) : (
            <div className="space-y-3" aria-hidden>
              <span className="block h-3 w-24 rounded bg-surface" />
              <span className="block h-7 w-4/5 rounded bg-surface" />
              <span className="block h-4 w-1/2 rounded bg-surface" />
            </div>
          )}
        </div>

        {others.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {others.map((b) => (
              <li key={b.id} className="flex items-baseline gap-3 text-[14.5px]">
                {/* Call numbers read left to right but line up on the start edge of the list, in Arabic too. */}
                <span className="w-24 shrink-0 truncate text-start font-mono text-[12.5px] text-muted-foreground"><bdi dir="ltr">{b.shelfLocation || "—"}</bdi></span>
                <Link to={`/books/${b.id}`} dir="auto" className="min-w-0 truncate text-ink hover:text-brand-dark hover:underline">{b.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The far arch, where the daylight comes in: the motto, the building, and when the desk is open. */
function Visit() {
  const { t, dir } = useI18n();
  const { me } = useAuth();
  const Forward = dir === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <div className={cn(STATION, "flex-col justify-center gap-10")}>
      <p className="flex w-full max-w-[37.5rem] items-center gap-5 text-center font-display text-[clamp(1.375rem,1rem+1.2vw,2rem)] font-semibold text-brand-dark">
        <span aria-hidden className="hidden h-px flex-1 bg-[#B8975A]/60 sm:block" />
        <span className={cn(PLAQUE, "mx-auto px-6 py-2.5")}>{t("landing.motto")}</span>
        <span aria-hidden className="hidden h-px flex-1 bg-[#B8975A]/60 sm:block" />
      </p>

      <div className={cn(PLAQUE, "grid w-full max-w-[37.5rem] overflow-hidden sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
        {/* The building in an arched window, the shape of the arcade it ends. */}
        <div className="p-4 pb-0 sm:p-5 sm:pe-0">
          <div className="h-56 overflow-hidden rounded-t-[999px] bg-surface sm:h-full sm:min-h-[22rem]">
            <SitePhoto slot="hero" sizes="(min-width: 640px) 240px, 100vw" className="size-full object-cover" />
          </div>
        </div>
        <div className="p-6 sm:p-9">
          <h2 className="type-title text-ink">{t("landing.visitTitle")}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{t("landing.visitLead")}</p>
          <dl className="mt-8 space-y-5">
            <div className="flex gap-4">
              <dt className="mt-0.5"><Clock className="size-5 text-brand" aria-hidden /><span className="sr-only">{t("landing.hoursLabel")}</span></dt>
              <dd>
                <span className="block font-medium text-ink">{t("landing.hoursDays")}</span>
                <span className="tabular mt-0.5 block font-display text-2xl text-ink" dir="ltr">08:00 – 16:30</span>
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="mt-0.5"><MapPin className="size-5 text-brand" aria-hidden /><span className="sr-only">{t("landing.addressLabel")}</span></dt>
              <dd className="text-ink">
                <span className="block font-medium">{t("brand.facultyLine")}</span>
                <span className="mt-0.5 block text-muted-foreground">{t("footer.address")}</span>
              </dd>
            </div>
          </dl>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12">
              <Link to="/catalog">{t("landing.browseCatalog")} <Forward className="size-4" aria-hidden /></Link>
            </Button>
            {!me && (
              <Button asChild size="lg" variant="outline" className="h-12"><Link to="/signup">{t("nav.join")}</Link></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
