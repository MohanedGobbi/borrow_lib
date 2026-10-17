import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from "react-router";
import { Bell, ClipboardList, Globe, Info, LogOut, Menu, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { useCart } from "@/cart/CartContext";
import { flushDeferredActions } from "@/hooks/useDeferredAction";
import { useI18n, type Lang } from "@/i18n";
import { useRuleVars } from "@/hooks/useLibrarySettings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiAuth, apiMisc } from "@/api";
import { invalidateNotifications, qk } from "@/api/queryKeys";
import { DEMO, resetDemo } from "@/api/client";
import { notificationText } from "@/lib/errors";
import { useHeroHeaderState } from "@/lib/heroHeader";
import { siteImageCredits, useSiteImages } from "@/lib/siteImages";
import { timeAgo } from "@/lib/time";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VerifyBanner } from "@/components/VerifyBanner";
import { Wordmark } from "@/components/Wordmark";

const LANGS: { code: Lang; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/**
 * Header colours. Over the landing photograph the bar is transparent with white text; everywhere else
 * (and once the photograph has scrolled away) it is white glass with a hairline edge.
 */
const TONE = {
  overlay: {
    bar: "border-transparent bg-transparent",
    link: "text-white/80 hover:text-white",
    active: "text-white after:bg-white",
    icon: "text-white/85 hover:bg-white/10 hover:text-white",
    quiet: "border-white/45 text-white hover:border-white/80 hover:bg-white/10",
    avatar: "bg-white/15 text-white",
    sub: "text-white/70",
  },
  glass: {
    bar: "glass-bar",
    link: "text-ink/70 hover:text-ink",
    active: "text-brand-dark after:bg-brand",
    icon: "text-ink/75 hover:bg-surface hover:text-ink",
    quiet: "border-input text-ink hover:border-ink/30 hover:bg-surface",
    avatar: "bg-brand-soft text-brand-dark",
    sub: "text-muted-foreground",
  },
};

const iconBtn = "relative inline-flex size-9 items-center justify-center rounded-md transition-colors sm:size-10";

export function Layout() {
  const { me, logout } = useAuth();
  const { t, lang, setLang, dir } = useI18n();
  const ruleVars = useRuleVars();
  const { bookIds } = useCart();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const location = useLocation();
  const hero = useHeroHeaderState();
  const [menuOpen, setMenuOpen] = useState(false);
  const isStaff = !!me && me.role !== "MEMBER";
  const isMember = !!me && me.role === "MEMBER";
  const isStaffArea = location.pathname.startsWith("/staff") || location.pathname.startsWith("/scan/");
  // the staff desk is wider, and its header lines up with the sidebar
  const width = isStaffArea ? "max-w-[1440px] px-4 sm:px-6" : "max-w-7xl px-4 sm:px-6 lg:px-8";
  const tone = hero.present && hero.over ? TONE.overlay : TONE.glass;

  // A new page starts at the top; back and forward keep the browser's own scroll restoration.
  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [location.pathname, navigationType]);

  const NAV = [
    { to: "/catalog", label: t("nav.catalog"), show: true },
    { to: "/my-requests", label: t("nav.myRequests"), show: isMember },
    { to: "/staff", label: t("nav.staff"), show: isStaff },
  ].filter((n) => n.show);

  const FOOTER_NAV = [
    { to: "/catalog", label: t("nav.catalog") },
    ...(isMember ? [{ to: "/my-requests", label: t("nav.myRequests") }, { to: "/cart", label: t("nav.cart") }] : []),
    ...(isStaff ? [{ to: "/staff", label: t("nav.staff") }] : []),
    ...(me
      ? [{ to: "/profile", label: t("nav.profile") }]
      : [{ to: "/login", label: t("nav.signin") }, { to: "/signup", label: t("nav.join") }]),
  ];

  const qc = useQueryClient();
  const { data: notifications } = useQuery({
    queryKey: qk.notifications, queryFn: apiMisc.notifications, enabled: !!me, refetchInterval: 30_000,
  });
  const unread = (notifications ?? []).filter((n) => !n.read).length;
  const markRead = useMutation({
    mutationFn: apiMisc.markRead,
    onSuccess: () => invalidateNotifications(qc),
  });

  // The account remembers the language, because the emails the library sends use it.
  const changeLang = (code: Lang) => {
    setLang(code);
    if (me) apiAuth.setLanguage(code).catch(() => { /* the switch itself already worked */ });
  };

  const signOut = async () => {
    await flushDeferredActions(); // a pickup or return still in its undo window is saved before the session ends
    await logout();
    navigate("/");
  };

  const { data: siteImages } = useSiteImages();
  const credits = siteImageCredits(siteImages);

  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        {t("common.skip")}
      </a>

      {/* Notices sit above the header, so the header can lie over the landing photograph. */}
      {DEMO && (
        <aside aria-label={t("demo.label")} className="bg-brand-dark text-white/85">
          <div className={cn("mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[13px] leading-snug", width)}>
            <Info className="hidden size-4 shrink-0 text-white/70 sm:block" aria-hidden />
            <span className="min-w-0">
              <span className="sm:hidden">{t("demo.noticeShort")}</span>
              <span className="hidden sm:inline">{t("demo.notice")}</span>
            </span>
            <span className="flex flex-wrap gap-x-4">
              <button type="button" onClick={resetDemo} className="font-medium text-white underline decoration-white/40 underline-offset-[3px] hover:decoration-white">
                {t("demo.reset")}
              </button>
              <Link to="/demo/mailbox" className="font-medium text-white underline decoration-white/40 underline-offset-[3px] hover:decoration-white">
                {t("mailbox.open")}
              </Link>
            </span>
          </div>
        </aside>
      )}
      <VerifyBanner wide={isStaffArea} />

      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-[background-color,border-color,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          tone.bar,
          // over a hero, the header takes no room of its own: the photograph runs up behind it
          hero.present && "-mb-16",
        )}
      >
        <div className={cn("mx-auto flex h-16 items-center gap-2 sm:gap-3", width)}>
          <Link to="/" className="-mx-1 shrink-0 rounded-sm px-1 py-1" aria-label="LibBorrow">
            <Wordmark tone={tone === TONE.overlay ? "white" : "ink"} />
          </Link>

          <nav className="ms-10 hidden h-full items-stretch gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center px-3 text-[15px] font-medium transition-colors",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-transparent",
                    tone.link,
                    // the member workstation (/scan/:uuid) is part of the staff desk
                    (isActive || (n.to === "/staff" && isStaffArea)) && tone.active,
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn("inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors sm:h-10 sm:px-2.5", tone.icon)} aria-label={t("nav.language")}>
                <Globe className="size-[18px]" aria-hidden />
                <span className="uppercase">{lang}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {LANGS.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => changeLang(l.code)}
                    className={cn(lang === l.code && "font-semibold text-brand-dark")}
                    lang={l.code}
                  >
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {me ? (
              <>
                {isMember && (
                  <Link to="/cart" className={cn(iconBtn, tone.icon, "hidden sm:inline-flex")} aria-label={`${t("nav.cart")} (${bookIds.length})`}>
                    <ClipboardList className="size-5" aria-hidden />
                    {bookIds.length > 0 && (
                      <span className="tabular absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-xs font-semibold text-white">
                        {bookIds.length}
                      </span>
                    )}
                  </Link>
                )}

                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open && unread > 0) markRead.mutate();
                  }}
                >
                  <DropdownMenuTrigger className={cn(iconBtn, tone.icon)} aria-label={`${t("nav.notifications")} (${unread})`}>
                    <Bell className="size-5" aria-hidden />
                    {unread > 0 && (
                      <span className="tabular absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-white">
                        {unread}
                      </span>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
                    <DropdownMenuLabel className="border-b px-4 py-3 text-sm font-semibold">{t("nav.notifications")}</DropdownMenuLabel>
                    {(notifications ?? []).length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("nav.noNotifications")}</p>
                    ) : (
                      <ul className="max-h-96 divide-y overflow-y-auto">
                        {(notifications ?? []).slice(0, 8).map((n) => (
                          <li key={n.id} className="flex gap-3 px-4 py-3">
                            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} aria-hidden />
                            <span>
                              <span dir="auto" className="block text-sm leading-snug">{notificationText(t, n)}</span>
                              <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.at)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn("ms-1 flex items-center gap-2 rounded-md p-1 transition-colors sm:pe-2.5", tone.icon)}
                    aria-label={t("nav.account")}
                  >
                    <span className={cn("flex size-8 items-center justify-center rounded-full text-xs font-semibold", tone.avatar)}>
                      {initials(me.name)}
                    </span>
                    <span className="hidden text-start leading-tight lg:block">
                      <span className="block text-sm font-medium">{me.name}</span>
                      <span className={cn("block text-xs", tone.sub)}>{t(`role.${me.role}`)}</span>
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="font-normal">
                      <span className="block text-sm font-semibold">{me.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile"><UserRound className="size-4" /> {t("nav.profile")}</Link>
                    </DropdownMenuItem>
                    {isMember && (
                      <DropdownMenuItem asChild>
                        <Link to="/cart"><ClipboardList className="size-4" /> {t("nav.cart")}</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="text-danger focus:text-danger">
                      <LogOut className="size-4" /> {t("nav.signout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : location.pathname === "/login" ? null : (
              <Link
                to="/login"
                className={cn(
                  "ms-0.5 inline-flex h-9 items-center whitespace-nowrap rounded-md border px-2.5 text-[14.5px] font-medium transition-colors sm:ms-1 sm:px-3.5",
                  tone.quiet,
                )}
              >
                {t("nav.signin")}
              </Link>
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger className={cn(iconBtn, tone.icon, "md:hidden")} aria-label={t("nav.menu")}>
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-72 bg-white p-0">
                <SheetTitle className="border-b px-5 py-4"><Wordmark /></SheetTitle>
                <nav className="flex flex-col p-2" aria-label="Main">
                  {[...NAV, ...(me ? [{ to: "/profile", label: t("nav.profile") }] : [{ to: "/login", label: t("nav.signin") }, { to: "/signup", label: t("nav.join") }])].map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn("rounded-md px-3 py-2.5 text-[15px] font-medium", isActive ? "bg-brand-soft text-brand-dark" : "hover:bg-surface")
                      }
                    >
                      {n.label}
                    </NavLink>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-surface text-ink">
        {!isStaffArea && (
          <div className={cn("mx-auto flex flex-col gap-8 pb-10 pt-12 md:flex-row md:items-end md:justify-between lg:pt-16", width)}>
            <Link to="/" className="-mx-1 w-fit rounded-sm px-1" aria-label="LibBorrow">
              <Wordmark size="footer" />
            </Link>
            <nav aria-label={t("footer.nav")}>
              <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
                {FOOTER_NAV.map((n) => (
                  <li key={n.to}>
                    <Link to={n.to} className="text-ink/80 transition-colors hover:text-ink hover:underline">{n.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}
        <div className={cn("mx-auto", width)}>
          <div className={cn(
            "flex flex-col gap-x-8 gap-y-1.5 py-5 text-[13px] leading-relaxed text-muted-foreground md:flex-row md:items-baseline md:justify-between",
            !isStaffArea && "border-t",
          )}>
            <div className="space-y-1.5">
              {!isStaffArea && (
                <p className="text-ink/80">
                  {/* the university's name in each of the site's languages, each set in its own direction */}
                  <span lang="en" dir="ltr">University of Ghardaia</span>
                  {" · "}
                  <span lang="fr" dir="ltr">Université de Ghardaïa</span>
                  {" · "}
                  <span lang="ar" dir="rtl">جامعة غرداية</span>
                </p>
              )}
              <p>
                {isStaffArea && <span className="text-ink/80">LibBorrow · {t("brand.library")} · </span>}
                {t("footer.rules", ruleVars)}
              </p>
            </div>
            <p>
              {credits.unsplash.length > 0 && (
                <>
                  {t("footer.photos")}{" "}
                  {credits.unsplash.map((c, i) => (
                    <span key={c.url}>
                      {i > 0 && ", "}
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline decoration-ink/20 hover:text-ink hover:decoration-ink/60">
                        <bdi>{c.name}</bdi>
                      </a>
                    </span>
                  ))}
                </>
              )}
              {/* The library's own photographs, credited in the words the admin typed. */}
              {credits.text.map((line, i) => (
                <span key={line}>
                  {(i > 0 || credits.unsplash.length > 0) && " · "}
                  <bdi>{line}</bdi>
                </span>
              ))}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Centered content container for member-facing pages. */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12", className)}>{children}</div>;
}
