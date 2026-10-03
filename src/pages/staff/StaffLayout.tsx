import { NavLink, Outlet } from "react-router";
import {
  Activity, BarChart3, BookCopy, ClipboardCheck, LayoutDashboard, ListOrdered, PackageCheck, SlidersHorizontal, Undo2, Users,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiMisc, apiRecords } from "@/api";
import { qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { DeskSearch } from "@/components/DeskSearch";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type CountKey = "pending" | "ready" | "overdue";

const GROUPS: { key: string; adminOnly?: boolean; items: { to: string; key: string; icon: LucideIcon; end?: boolean; count?: CountKey }[] }[] = [
  {
    key: "staff.groupDesk",
    items: [
      { to: "/staff", key: "staff.overview", icon: LayoutDashboard, end: true },
      { to: "/staff/approvals", key: "staff.approvals", icon: ClipboardCheck, count: "pending" },
      { to: "/staff/pickups", key: "staff.pickups", icon: PackageCheck, count: "ready" },
      { to: "/staff/loans", key: "staff.loans", icon: Undo2, count: "overdue" },
    ],
  },
  {
    key: "staff.groupCollection",
    items: [
      { to: "/staff/inventory", key: "staff.inventory", icon: BookCopy },
      { to: "/staff/reservations", key: "staff.reservations", icon: ListOrdered },
    ],
  },
  {
    key: "staff.groupRecords",
    items: [
      { to: "/staff/users", key: "staff.users", icon: Users },
      { to: "/staff/analytics", key: "staff.analytics", icon: BarChart3 },
      { to: "/staff/activity", key: "staff.activity", icon: Activity },
    ],
  },
  {
    key: "staff.groupLibrary",
    adminOnly: true,
    items: [{ to: "/staff/settings", key: "staff.settings", icon: SlidersHorizontal }],
  },
];

/** Staff area shell: grouped side navigation with live queue counts. */
export default function StaffLayout() {
  const { t } = useI18n();
  const { me } = useAuth();
  const groups = GROUPS.filter((g) => !g.adminOnly || me?.role === "ADMIN");
  // Staff actions invalidate these keys, so the counts move at once instead of waiting for the poll.
  const { data: stats } = useQuery({ queryKey: qk.stats, queryFn: apiMisc.stats, refetchInterval: 45_000 });
  const { data: pending } = useQuery({
    queryKey: qk.records.list({ status: "PENDING", pageSize: 1 }),
    queryFn: () => apiRecords.list({ status: "PENDING", pageSize: 1 }),
    refetchInterval: 45_000,
  });

  const counts: Record<CountKey, number> = {
    pending: pending?.count ?? 0,
    ready: stats?.totalReady ?? 0,
    overdue: stats?.totalOverdue ?? 0,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col lg:flex-row">
      <aside className="border-b bg-surface [mask-image:linear-gradient(to_right,black_88%,transparent)] rtl:[mask-image:linear-gradient(to_left,black_88%,transparent)] lg:[mask-image:none] rtl:lg:[mask-image:none] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-e">
        <nav aria-label={t("nav.staff")} className="flex gap-1 overflow-x-auto px-3 py-2 lg:block lg:space-y-7 lg:overflow-visible lg:px-3 lg:py-7">
          {groups.map((g) => (
            <div key={g.key} className="flex shrink-0 gap-1 lg:block">
              <h2 className="hidden px-3 pb-2 text-[13px] font-medium text-muted-foreground lg:block">
                {t(g.key)}
              </h2>
              <ul className="flex gap-1 lg:block lg:space-y-px">
                {g.items.map((item) => {
                  const n = item.count ? counts[item.count] : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors lg:py-[7px]",
                            isActive
                              ? "bg-brand-soft font-semibold text-brand-dark"
                              : "font-medium text-ink/75 hover:bg-ink/[0.045] hover:text-ink",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon className={cn("size-[18px] shrink-0", isActive ? "text-brand" : "text-muted-foreground group-hover:text-ink")} aria-hidden />
                            <span className="flex-1">{t(item.key)}</span>
                            {n > 0 && (
                              <span
                                className={cn(
                                  "tabular text-[13px]",
                                  item.count === "overdue"
                                    ? "rounded-full bg-danger px-2 py-px font-semibold text-white"
                                    : cn("font-medium", isActive ? "text-brand-dark" : "text-muted-foreground"),
                                )}
                              >
                                {n}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <DeskSearch className="mb-8" />
        <Outlet />
      </div>
    </div>
  );
}
