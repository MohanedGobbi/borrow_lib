import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Bell, ClipboardList, Globe, Info, LibraryBig, LogOut, Menu, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { useCart } from "@/cart/CartContext";
import { useI18n, type Lang } from "@/i18n";
import { useApi } from "@/hooks/useApi";
import { apiMisc } from "@/api";
import { DEMO, resetDemo } from "@/api/client";
import { timeAgo } from "@/lib/time";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const LANGS: { code: Lang; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

const iconBtn =
  "relative inline-flex size-9 items-center justify-center rounded-md sm:size-10 text-ink/75 transition-colors hover:bg-surface hover:text-ink";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function BrandMark({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-white">
        <LibraryBig className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold tracking-tight text-ink">LibBorrow</span>
        <span className="block whitespace-nowrap text-xs text-muted-foreground">{t("brand.library")}</span>
      </span>
    </span>
  );
}

export function Layout() {
  const { me, logout } = useAuth();
  const { t, lang, setLang, dir } = useI18n();
  const { bookIds } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isStaff = !!me && me.role !== "MEMBER";
  const isMember = !!me && me.role === "MEMBER";
  const isStaffArea = location.pathname.startsWith("/staff");

  const NAV = [
    { to: "/catalog", label: t("nav.catalog"), show: true },
    { to: "/my-requests", label: t("nav.myRequests"), show: isMember },
    { to: "/staff", label: t("nav.staff"), show: isStaff },
  ].filter((n) => n.show);

  const { data: notifications, refetch } = useApi(
    () => (me ? apiMisc.notifications() : Promise.resolve([])),
    [me?.id],
    me ? 30_000 : undefined,
  );
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const signOut = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        {t("common.skip")}
      </a>
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", isStaffArea ? "max-w-[1440px]" : "max-w-7xl")}>
          <Link to="/" className="rounded-md" aria-label="LibBorrow">
            <BrandMark />
          </Link>

          <nav className="ms-8 hidden h-full items-stretch gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center px-3 text-[15px] font-medium text-ink/70 transition-colors hover:text-ink",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent",
                    isActive && "text-brand-dark after:bg-brand",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(iconBtn, "w-auto gap-1.5 px-2.5 text-sm font-medium")} aria-label={t("nav.language")}>
                <Globe className="size-[18px]" aria-hidden />
                <span className="uppercase">{lang}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {LANGS.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => setLang(l.code)}
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
                  <Link to="/cart" className={cn(iconBtn, "hidden sm:inline-flex")} aria-label={`${t("nav.cart")} (${bookIds.length})`}>
                    <ClipboardList className="size-5" aria-hidden />
                    {bookIds.length > 0 && (
                      <span className="tabular absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                        {bookIds.length}
                      </span>
                    )}
                  </Link>
                )}

                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open && unread > 0) apiMisc.markRead().then(() => refetch()).catch(() => {});
                  }}
                >
                  <DropdownMenuTrigger className={iconBtn} aria-label={`${t("nav.notifications")} (${unread})`}>
                    <Bell className="size-5" aria-hidden />
                    {unread > 0 && (
                      <span className="tabular absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
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
                              <span className="block text-sm leading-snug">{n.message}</span>
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
                    className="ms-1 flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface sm:pe-2.5"
                    aria-label={t("nav.account")}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-dark">
                      {initials(me.name)}
                    </span>
                    <span className="hidden text-start leading-tight lg:block">
                      <span className="block text-sm font-medium">{me.name}</span>
                      <span className="block text-xs text-muted-foreground">{t(`role.${me.role}`)}</span>
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
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/login">{t("nav.signin")}</Link>
                </Button>
                <Button asChild className="hidden sm:inline-flex">
                  <Link to="/signup">{t("nav.join")}</Link>
                </Button>
              </>
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger className={cn(iconBtn, "md:hidden")} aria-label={t("nav.menu")}>
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-72 bg-white p-0">
                <SheetTitle className="border-b px-5 py-4"><BrandMark /></SheetTitle>
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

      {DEMO && (
        <div className="border-b bg-surface">
          <div className={cn("mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] text-muted-foreground sm:px-6", isStaffArea ? "max-w-[1440px]" : "max-w-7xl")}>
            <Info className="size-4 shrink-0 text-brand" aria-hidden />
            <span>{t("demo.notice")}</span>
            <button type="button" onClick={resetDemo} className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand">
              {t("demo.reset")}
            </button>
          </div>
        </div>
      )}

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>LibBorrow · {t("brand.library")}</span>
          <span>{t("footer.rules")}</span>
        </div>
      </footer>
    </div>
  );
}

/** Centered content container for member-facing pages. */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10", className)}>{children}</div>;
}
