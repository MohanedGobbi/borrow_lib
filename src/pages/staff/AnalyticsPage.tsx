import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiMisc } from "@/api";
import { qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { cn } from "@/lib/utils";

// Chart palette follows the UI: green for healthy flow, red only for overdue, neutrals for the rest.
const INK = "#121A16";
const GREEN = "#0E6B3C";
const GREEN_LIGHT = "#7FB896";
const GRID = "#E3E8E5";
const MUTED = "#5B6660";
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#9AA59F", READY: GREEN_LIGHT, BORROWED: GREEN, RETURNED: "#4A5550",
  REJECTED: "#C5CCC8", CANCELLED: "#C5CCC8", OVERDUE: "#B42318",
};
const axis = { fontSize: 12, fill: MUTED };
const tooltip = {
  contentStyle: { borderRadius: 6, border: `1px solid ${GRID}`, fontSize: 13, boxShadow: "0 2px 8px rgb(16 24 20 / 0.08)" },
  cursor: { fill: "rgb(14 107 60 / 0.06)" },
};

export default function AnalyticsPage() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: qk.analytics, queryFn: apiMisc.analytics, refetchInterval: 60_000 });

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("staff.analytics")} />
        <div className="rounded-md border bg-white"><RowsSkeleton rows={3} /></div>
      </div>
    );
  }

  const statusData = Object.entries(data.statusDistribution).map(([status, n]) => ({
    status, label: t(`status.${status}`), count: n, fill: STATUS_COLORS[status] ?? MUTED,
  }));
  const categoryData = [...data.categoryLoans].sort((a, b) => b.loans - a.loans);

  const kpis = [
    { label: t("analytics.fulfillment"), value: `${data.fulfillmentRate}%`, help: t("analytics.fulfillmentHelp") },
    { label: t("dash.onLoan"), value: data.statusDistribution.BORROWED ?? 0 },
    { label: t("dash.overdue"), value: data.statusDistribution.OVERDUE ?? 0, danger: (data.statusDistribution.OVERDUE ?? 0) > 0 },
    { label: t("analytics.reservations"), value: data.activeReservations },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("staff.analytics")} />

      <dl className="grid grid-cols-2 overflow-hidden rounded-md border bg-white lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={cn("p-4", i % 2 === 0 && "border-e", i < 2 && "border-b lg:border-b-0", i === 1 && "lg:border-e", i === 2 && "lg:border-e")}>
            <dt className="text-sm text-muted-foreground">{k.label}</dt>
            <dd className={cn("tabular mt-1 text-[1.75rem] font-semibold leading-none", k.danger ? "text-danger" : "text-ink")}>{k.value}</dd>
            {k.help && <dd className="mt-1.5 text-xs text-muted-foreground">{k.help}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t("analytics.monthly")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthly} barGap={2}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...tooltip} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="loans" name={t("analytics.loans")} fill={GREEN} radius={[2, 2, 0, 0]} maxBarSize={28} />
              <Bar dataKey="returns" name={t("analytics.returns")} fill={GREEN_LIGHT} radius={[2, 2, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t("analytics.category")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis type="category" dataKey="name" width={96} tick={{ ...axis, fill: INK }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltip} />
              <Bar dataKey="loans" name={t("analytics.loans")} radius={[0, 2, 2, 0]} maxBarSize={22}>
                {categoryData.map((c) => <Cell key={c.name} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t("analytics.status")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis type="category" dataKey="label" width={120} tick={{ ...axis, fill: INK }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltip} />
              <Bar dataKey="count" radius={[0, 2, 2, 0]} maxBarSize={22}>
                {statusData.map((s) => <Cell key={s.status} fill={s.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t("analytics.members")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthly}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...tooltip} />
              <Bar dataKey="newMembers" name={t("analytics.members")} fill={GREEN} radius={[2, 2, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title={t("analytics.top")}>
        <ResponsiveContainer width="100%" height={Math.max(160, data.topBooks.length * 40)}>
          <BarChart data={data.topBooks} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis type="category" dataKey="title" width={240} tick={{ ...axis, fill: INK }} tickLine={false} axisLine={false} />
            <Tooltip {...tooltip} />
            <Bar dataKey="requests" fill={GREEN} radius={[0, 2, 2, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
