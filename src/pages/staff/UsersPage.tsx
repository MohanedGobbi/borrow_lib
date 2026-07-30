import { useState } from "react";
import { Link } from "react-router";
import { Search } from "lucide-react";
import { apiUsers } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { Input } from "@/components/ui/input";
import { FullPageLoader } from "@/auth/guards";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const { data: users, loading } = useApi(
    () => apiUsers.list(role === "all" ? {} : { role }),
    [role],
    60_000
  );

  if (loading) return <FullPageLoader />;
  const q = search.trim().toLowerCase();
  const filtered = (users ?? []).filter(
    (u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.studentOrStaffId.toLowerCase().includes(q)
  );

  return (
    <div className="rounded-md border border-border bg-cream p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
          {t("users.title")} · {filtered.length}
        </h2>
        <div className="relative ms-auto min-w-[220px]">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="bg-white ps-8" placeholder={t("users.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[140px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("catalog.all")}</SelectItem>
            <SelectItem value="MEMBER">{t("auth.member")}</SelectItem>
            <SelectItem value="STAFF">{t("auth.staff")}</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("users.noUsers")}</p>
      ) : (
        <div className="mt-3 divide-y divide-border rounded-sm border border-border bg-white">
          {filtered.map((u) => (
            <Link
              key={u.id}
              to={`/staff/users/${u.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-cream"
            >
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-semibold">{u.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{u.email} · {u.studentOrStaffId}</p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {u.activeLoans}/{u.maxBorrowLimit} {t("users.loans")}
              </span>
              <span className={cn(
                "rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                u.role === "ADMIN" ? "bg-ink text-white" : u.role === "STAFF" ? "bg-burnt text-white" : "bg-brand-soft text-brand-dark"
              )}>
                {u.role}
              </span>
              {u.hasOverdue && (
                <span className="rounded-sm bg-danger px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  {t("dash.overdue")}
                </span>
              )}
              {!u.active && (
                <span className="rounded-sm bg-ink/40 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  inactive
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
