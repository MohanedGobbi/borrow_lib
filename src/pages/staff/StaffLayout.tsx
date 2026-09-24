import { NavLink, Outlet } from "react-router";
import type { StaffContext } from "@/pages/staff/staffContext";
import {
  Activity, BarChart3, BookCopy, ClipboardCheck, LayoutDashboard, ListOrdered, PackageCheck, Undo2, Users,
  type LucideIcon,
} from "lucide-react";
import { apiMisc, apiRecords } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type CountKey = "pending" | "ready" | "overdue";

const GROUPS: { key: string; items: { to: string; key: string; icon: LucideIcon; end?: boolean; count?: CountKey }[] }[] = [
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
];

/** Staff area shell: grouped side navigation with live queue counts. */
export default function StaffLayout() {
  const { t } = useI18n();
  const { data: stats, refetch: refetchStats } = useApi(() => apiMisc.stats(), [], 45_000);
  const { data: pending, refetch: refetchPending } = useApi(() => apiRecords.list({ status: "PENDING" }), [], 45_000);

  const counts: Record<CountKey, number> = {
    pending: pending?.length ?? 0,
    ready: stats?.totalReady ?? 0,
    overdue: stats?.totalOverdue ?? 0,
  };
  const refreshCounts = () => { refetchStats(); refetchPending(); };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col lg:flex-row">
      <aside className="border-b bg-surface [mask-image:linear-gradient(to_right,black_88%,transparent)] rtl:[mask-image:linear-gradient(to_left,black_88%,transparent)] lg:[mask-image:none] rtl:lg:[mask-image:none] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-e">
        <nav aria-label={t("nav.staff")} className="flex gap-1 overflow-x-auto px-3 py-2 lg:block lg:space-y-6 lg:overflow-visible lg:px-3 lg:py-6">
          {GROUPS.map((g) => (
            <div key={g.key} className="flex shrink-0 gap-1 lg:block">
              <h2 className="hidden px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
                {t(g.key)}
              </h2>
              <ul className="flex gap-1 lg:block lg:space-y-0.5">
                {g.items.map((item) => {
                  const n = item.count ? counts[item.count] : 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium transition-colors",
                            isActive ? "bg-white text-brand-dark shadow-[0_1px_2px_rgb(16_24_20/0.08)] ring-1 ring-border" : "text-ink/75 hover:bg-white/70 hover:text-ink",
                          )
                        }
                      >
                        <item.icon className="size-[18px] shrink-0" aria-hidden />
                        <span className="flex-1">{t(item.key)}</span>
                        {n > 0 && (
                          <span
                            className={cn(
                              "tabular rounded-full px-2 py-px text-xs font-semibold",
                              item.count === "overdue" ? "bg-danger text-white" : "bg-brand-soft text-brand-dark",
                            )}
                          >
                            {n}
                          </span>
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
      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <Outlet context={{ refreshCounts } satisfies StaffContext} />
      </div>
    </div>
  );
}
