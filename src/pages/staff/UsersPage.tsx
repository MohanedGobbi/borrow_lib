import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { MailPlus, Search, Upload, UserX } from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiInvites, apiUsers } from "@/api";
import { invalidateInvites, qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useDebounced } from "@/hooks/useDebounced";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { InviteStaffDialog } from "@/components/InviteStaffDialog";
import { MemberStanding } from "@/components/MemberStanding";
import { Pager } from "@/components/Pager";
import { EmptyState, PageHeader, Panel, RowsSkeleton } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchPage } from "@/lib/paging";
import { fmtDate } from "@/lib/time";
import { tableCls } from "@/lib/table";

export default function UsersPage() {
  const { t } = useI18n();
  const { me } = useAuth();
  const isAdmin = me?.role === "ADMIN";
  const [inviting, setInviting] = useState(false);
  const qc = useQueryClient();
  const { data: invites } = useQuery({ queryKey: qk.invites, queryFn: apiInvites.list, enabled: isAdmin });
  const revoke = useMutation({
    mutationFn: (id: number) => apiInvites.revoke(id),
    onSuccess: () => {
      toast.success(t("invite.revoked"));
      return invalidateInvites(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const debouncedSearch = useDebounced(search.trim(), 300);
  // The page belongs to one search + role: a new filter starts again from page 1.
  const filterKey = `${debouncedSearch}|${role}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });
  const listParams = { search: debouncedSearch, role: role === "all" ? undefined : role, page };
  const { data: result, isPending } = useQuery({
    queryKey: qk.users.list(listParams),
    queryFn: () => fetchPage((p) => apiUsers.list({ ...listParams, page: p }), page),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const filtered = result?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users.title")}
        actions={isAdmin && (
          <>
            <Button asChild variant="outline">
              <Link to="/staff/users/import"><Upload aria-hidden /> {t("sImport.title")}</Link>
            </Button>
            <Button onClick={() => setInviting(true)}><MailPlus aria-hidden /> {t("invite.button")}</Button>
          </>
        )}
      />
      {isAdmin && (
        <>
          <InviteStaffDialog open={inviting} onOpenChange={setInviting} />
          <Panel title={t("invite.pending")} count={(invites ?? []).length} flush>
            {(invites ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("invite.none")}</p>
            ) : (
              <div className={tableCls.wrap}>
                <table className={tableCls.table}>
                  <thead>
                    <tr>
                      <th className={tableCls.th}>{t("auth.email")}</th>
                      <th className={tableCls.th}>{t("col.role")}</th>
                      <th className={tableCls.th}>{t("invite.invitedBy")}</th>
                      <th className={tableCls.th}>{t("invite.expires")}</th>
                      <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invites ?? []).map((i) => (
                      <tr key={i.id} className={tableCls.row}>
                        <td className={tableCls.td}><span dir="ltr" className="inline-block">{i.email}</span></td>
                        <td className={tableCls.td}>{t(`role.${i.role}`)}</td>
                        <td className={tableCls.td}>{i.createdBy ?? "—"}</td>
                        <td className={tableCls.td}><span className="tabular whitespace-nowrap">{fmtDate(i.expiresAt)}</span></td>
                        <td className={`${tableCls.td} text-end`}>
                          <Button variant="outline" size="sm" onClick={() => revoke.mutate(i.id)}>{t("invite.revoke")}</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
      <Panel
        title={t("users.all")}
        count={result?.count ?? 0}
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
        {isPending ? <RowsSkeleton /> : filtered.length === 0 ? (
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
                      <Link dir="auto" to={`/staff/users/${u.id}`} className="font-medium hover:text-brand-dark hover:underline">{u.name}</Link>
                      <div dir="ltr" className="text-xs text-muted-foreground rtl:text-end">{u.email}</div>
                    </td>
                    <td className={tableCls.td}><span dir="ltr" className="font-mono text-[13px]">{u.studentOrStaffId}</span></td>
                    <td className={tableCls.td}>{t(`role.${u.role}`)}</td>
                    <td className={tableCls.td}>
                      {u.role === "MEMBER"
                        ? <span dir="ltr" className="tabular inline-block">{u.activeLoans} / {u.maxBorrowLimit}</span>
                        : <span className="text-muted-foreground"><span aria-hidden>—</span><span className="sr-only">{t("users.noLimit")}</span></span>}
                    </td>
                    <td className={tableCls.td}><MemberStanding member={u} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && <Pager page={result.page} pageSize={result.pageSize} count={result.count} onPage={setPage} />}
      </Panel>
    </div>
  );
}
