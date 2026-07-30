import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Bell, Globe, LibraryBig, LogOut, Menu, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";
import { useCart } from "@/cart/CartContext";
import { useI18n, type Lang } from "@/i18n";
import { useApi } from "@/hooks/useApi";
import { apiMisc } from "@/api";
import { timeAgo } from "@/components/Countdown";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Layout() {
  const { me, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { bookIds } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const isStaff = !!me && me.role !== "MEMBER";
  const isMember = !!me && me.role === "MEMBER";

  const NAV = [
    { to: "/catalog", label: t("nav.catalog"), show: true },
    { to: "/my-requests", label: t("nav.myRequests"), show: isMember },
    { to: "/cart", label: t("nav.cart"), show: isMember },
    { to: "/staff", label: t("nav.staff"), show: isStaff },
    { to: "/profile", label: t("nav.profile"), show: !!me },
  ];

  const { data: notifications, refetch } = useApi(
    () => (me ? apiMisc.notifications() : Promise.resolve([])),
    [me?.id],
    me ? 30_000 : undefined
  );
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-cream">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-brand">
            <span className="flex size-10 items-center justify-center rounded-sm bg-burnt text-white">
              <LibraryBig className="size-6" />
            </span>
            <span className="leading-none">
              <span className="block text-xl font-bold tracking-tight">LibBorrow</span>
              <span className="block font-mono text-[11px] uppercase tracking-[0.25em] text-burnt">
                City Central Library
              </span>
            </span>
          </Link>

          {/* desktop nav */}
          <nav className="ms-6 hidden items-center gap-1.5 lg:flex">
            {NAV.filter((n) => n.show).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-sm px-4 py-2 text-[15px] font-medium transition-colors hover:bg-cream-deep focus-visible:outline-2 focus-visible:outline-brand",
                    isActive && "bg-ink text-white hover:bg-ink"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            {/* language switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-sm p-2.5 text-sm font-semibold uppercase hover:bg-cream-deep focus-visible:outline-2 focus-visible:outline-brand" aria-label="Language">
                <Globe className="size-5" /> {lang}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["en", "fr", "ar"] as Lang[]).map((l) => (
                  <DropdownMenuItem key={l} onClick={() => setLang(l)} className={cn(lang === l && "font-bold text-burnt")}>
                    {l === "en" ? "English" : l === "fr" ? "Français" : "العربية"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {me ? (
              <>
                {isMember && (
                  <Link to="/cart" className="relative rounded-sm p-2.5 hover:bg-cream-deep focus-visible:outline-2 focus-visible:outline-brand" aria-label={t("nav.cart")}>
                    <ShoppingCart className="size-5" />
                    {bookIds.length > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand font-mono text-[9px] font-bold text-ink">
                        {bookIds.length}
                      </span>
                    )}
                  </Link>
                )}
                <DropdownMenu onOpenChange={(open) => {
                  if (open) {
                    refetch();
                    apiMisc.markRead().then(() => refetch()).catch(() => {});
                  }
                }}>
                  <DropdownMenuTrigger className="relative rounded-sm p-2.5 hover:bg-cream-deep focus-visible:outline-2 focus-visible:outline-brand" aria-label={t("nav.notifications")}>
                    <Bell className="size-5" />
                    {unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-danger font-mono text-[9px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-burnt">
                      {t("nav.notifications")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(notifications ?? []).length === 0 && (
                      <div className="px-3 py-4 text-sm text-muted-foreground">—</div>
                    )}
                    {(notifications ?? []).slice(0, 6).map((n) => (
                      <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 whitespace-normal">
                        <span className="text-xs leading-snug">{n.message}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(n.at)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="hidden items-center gap-2 rounded-sm border border-border bg-white px-3.5 py-2 sm:flex">
                  <span className="text-sm font-semibold">{me.name}</span>
                  <span className="rounded-sm bg-cream px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-burnt">
                    {me.role}
                  </span>
                </div>
                <Button
                  variant="ghost" size="sm" aria-label={t("nav.signout")}
                  onClick={() => { logout(); navigate("/"); }}
                  className="text-muted-foreground hover:text-danger"
                >
                  <LogOut className="size-5" />
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost"><Link to="/login">{t("nav.signin")}</Link></Button>
                <Button asChild className="bg-burnt text-white hover:bg-burnt-dark">
                  <Link to="/signup">{t("nav.join")}</Link>
                </Button>
              </>
            )}

            {/* mobile menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger className="rounded-sm p-2 hover:bg-cream-deep lg:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side={lang === "ar" ? "left" : "right"} className="w-64 bg-cream">
                <nav className="mt-8 flex flex-col gap-1">
                  {NAV.filter((n) => n.show).map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "rounded-sm px-3 py-2.5 text-base font-medium",
                          isActive ? "bg-ink text-white" : "hover:bg-cream-deep"
                        )
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

      {/* Landing renders full-bleed (its own sections handle gutters);
          all other pages sit in the centered 1440px container. */}
      <main className={isLanding ? "" : "mx-auto max-w-[1440px] px-6 py-8 lg:py-10"}>
        <Outlet />
      </main>

      <footer className="mt-16 border-t-2 border-ink bg-burnt text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-5">
          <span className="font-mono text-xs uppercase tracking-[0.25em]">{t("footer.left")}</span>
          <span className="font-mono text-xs uppercase tracking-[0.25em] opacity-80">{t("footer.right")}</span>
        </div>
      </footer>
    </div>
  );
}
