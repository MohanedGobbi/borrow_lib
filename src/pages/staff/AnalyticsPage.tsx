import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiMisc } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { FullPageLoader } from "@/auth/guards";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#CC8800", READY: "#D97706", BORROWED: "#16A34A", RETURNED: "#9CA3AF",
  REJECTED: "#6B7280", CANCELLED: "#4B5563", OVERDUE: "#DC2626",
};

export default function AnalyticsPage() {
  const { t } = useI18n();
  const { data, loading } = useApi(() => apiMisc.analytics(), [], 60_000);

  if (loading || !data) return <FullPageLoader />;

  const statusData = Object.entries(data.statusDistribution).map(([status, n]) => ({
    status, count: n, fill: STATUS_COLORS[status] ?? "#CC8800",
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md bg-ink p-4 text-white">
          <p className="text-3xl font-bold tabular-nums">{data.fulfillmentRate}%</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">{t("analytics.fulfillment")}</p>
        </div>
        <div className="rounded-md bg-burnt p-4 text-white">
          <p className="text-3xl font-bold tabular-nums">{data.activeReservations}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{t("analytics.reservations")}</p>
        </div>
        <div className="rounded-md bg-brand p-4 text-white">
          <p className="text-3xl font-bold tabular-nums">{data.statusDistribution.OVERDUE ?? 0}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{t("dash.overdue")}</p>
        </div>
        <div className="rounded-md bg-success p-4 text-white">
          <p className="text-3xl font-bold tabular-nums">{data.statusDistribution.BORROWED ?? 0}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{t("dash.borrowed")}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("analytics.monthly")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="loans" name={t("analytics.loans")} fill="#C55221" radius={[3, 3, 0, 0]} />
              <Bar dataKey="returns" name={t("analytics.returns")} fill="#16A34A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("analytics.category")}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.categoryLoans} dataKey="loans" nameKey="name" innerRadius={50} outerRadius={90} label>
                {data.categoryLoans.map((c) => <Cell key={c.name} fill={c.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("analytics.status")}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="status" width={90} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {statusData.map((s) => <Cell key={s.status} fill={s.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("analytics.members")}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="newMembers" stroke="#CC8800" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title={t("analytics.top")}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.topBooks} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="title" width={220} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="requests" fill="#3E5C76" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}
