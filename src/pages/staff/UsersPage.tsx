import { useState } from "react";
import { Link } from "react-router";
import { Search, UserX } from "lucide-react";
import { apiUsers } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { MemberStanding } from "@/components/MemberStanding";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { Input } from "@/components/ui/input";
import { FullPageLoader } from "@/auth/guards";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { tableCls } from "@/lib/table";

export default function UsersPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const { data: users, loading } = useApi(() => apiUsers.list(role === "all" ? {} : { role }), [role], 60_000);

  if (loading) return <FullPageLoader />;
  const q = search.trim().toLowerCase();
  const filtered = (users ?? []).filter(
    (u) => !q || [u.name, u.email, u.studentOrStaffId].some((f) => f.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} />
      <Panel
        title={t("users.title")}
        count={filtered.length}
        flush
        actions={
          <>
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" className="h-9 ps-8" placeholder={t("users.search")} aria-label={t("users.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 w-40" aria-label={t("col.role")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("users.allRoles")}</SelectItem>
                <SelectItem value="MEMBER">{t("role.MEMBER")}</SelectItem>
                <SelectItem value="STAFF">{t("role.STAFF")}</SelectItem>
                <SelectItem value="ADMIN">{t("role.ADMIN")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState icon={UserX} title={t("users.noUsers")} />
        ) : (
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>{t("col.member")}</th>
                  <th className={tableCls.th}>{t("col.id")}</th>
                  <th className={tableCls.th}>{t("col.role")}</th>
                  <th className={tableCls.th}>{t("col.loans")}</th>
                  <th className={tableCls.th}>{t("col.standing")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={tableCls.row}>
                    <td className={tableCls.td}>
                      <Link to={`/staff/users/${u.id}`} className="font-medium hover:text-brand-dark hover:underline">{u.name}</Link>
                      <div dir="ltr" className="text-xs text-muted-foreground rtl:text-end">{u.email}</div>
                    </td>
                    <td className={tableCls.td}><span dir="ltr" className="font-mono text-[13px]">{u.studentOrStaffId}</span></td>
                    <td className={tableCls.td}>{t(`role.${u.role}`)}</td>
                    <td className={tableCls.td}><span className="tabular">{u.activeLoans} / {u.maxBorrowLimit}</span></td>
                    <td className={tableCls.td}><MemberStanding member={u} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
