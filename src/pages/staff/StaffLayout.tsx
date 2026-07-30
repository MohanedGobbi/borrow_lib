import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useAuth } from "@/auth/AuthContext";

const TABS = [
  { to: "/staff", key: "staff.overview", end: true },
  { to: "/staff/approvals", key: "staff.approvals" },
  { to: "/staff/pickups", key: "staff.pickups" },
  { to: "/staff/loans", key: "staff.loans" },
  { to: "/staff/inventory", key: "staff.inventory" },
  { to: "/staff/reservations", key: "staff.reservations" },
  { to: "/staff/users", key: "staff.users" },
  { to: "/staff/analytics", key: "staff.analytics" },
  { to: "/staff/activity", key: "staff.activity" },
];

/** Staff area shell: horizontal sub-navigation, one function per page. */
export default function StaffLayout() {
  const { t } = useI18n();
  const { me } = useAuth();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-burnt">{t("nav.staff")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{t("dash.title")}</h1>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">{me?.name} · {me?.role}</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-md border border-border bg-white p-1" aria-label="Staff sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                isActive ? "bg-burnt text-white" : "text-ink/70 hover:bg-cream"
              )
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
