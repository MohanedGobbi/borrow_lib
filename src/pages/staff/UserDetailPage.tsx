import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Trash2, UserX } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiUsers } from "@/api";
import { invalidateUsers, qk } from "@/api/queryKeys";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { StatusBadge } from "@/components/StatusBadge";
import { RequestDocButton } from "@/components/RequestDocButton";
import { MemberDesk } from "@/components/MemberDesk";
import { fmtDate } from "@/lib/time";
import { EmptyState, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import { tableCls } from "@/lib/table";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Staff view of one member: details and full borrowing history. Admins can delete the account. */
export default function UserDetailPage() {
  const { id } = useParams();
  const { me } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: qk.users.detail(id!), queryFn: () => apiUsers.get(Number(id)),
  });
  const remove = useMutation({
    mutationFn: (memberId: number) => apiUsers.remove(memberId),
    onSuccess: () => {
      toast.success(t("toast.userDeleted"));
      navigate("/staff/users");
      return invalidateUsers(qc);
    },
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  if (isPending) return <FullPageLoader />;
  if (isError || !data) {
    return (
      <EmptyState icon={UserX} title={t("users.noUsers")}>
        <Button asChild variant="outline" size="sm"><Link to="/staff/users">{t("users.back")}</Link></Button>
      </EmptyState>
    );
  }

  const { member, records } = data;

  const deleteAccount = () => remove.mutate(member.id);

  const details: [string, React.ReactNode][] = [
    [t("col.id"), <span dir="ltr" className="font-mono text-[14px]">{member.studentOrStaffId}</span>],
    [t("profile.email"), <span dir="ltr">{member.email}</span>],
    [t("profile.phone"), member.phoneNumber ? <span dir="ltr">{member.phoneNumber}</span> : "—"],
    [t("profile.role"), t(`role.${member.role}`)],
    [t("profile.since"), fmtDate(member.membershipStartDate)],
    ...(member.role === "MEMBER"
      ? [
        [t("profile.limit"), <span><bdi dir="ltr" className="tabular">{member.activeLoans} / {member.maxBorrowLimit}</bdi> {t("profile.inuse")}</span>],
        [t("profile.borrowLimit"), <span><span className="tabular">{member.maxBorrowLimit}</span> ({t(member.borrowLimitIsDefault ? "profile.limitDefault" : "profile.limitPersonal")})</span>],
      ] as [string, React.ReactNode][]
      : []), // staff and admins cannot borrow
  ];

  return (
    <div className="space-y-6">
      <Link to="/staff/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("users.back")}
      </Link>

      <MemberDesk
        member={member}
        records={records}
        historyHref="#history"
        actions={
          me?.role === "ADMIN" && me.id !== member.id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-danger hover:border-danger/40 hover:bg-danger-soft hover:text-danger">
                  <Trash2 className="size-4" aria-hidden /> {t("users.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("users.deleteConfirm")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {member.name} · <span dir="ltr">{member.email}</span>. {t("users.deleteBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={deleteAccount}>
                    {t("users.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title={t("profile.details")} flush className="h-fit">
          <dl className="divide-y">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-end">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div id="history" className="scroll-mt-24">
          <Panel title={t("users.history")} count={records.length} flush>
            {records.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("req.none")}</p>
            ) : (
              <div className={tableCls.wrap}>
                <table className={tableCls.table}>
                  <thead>
                    <tr>
                      <th className={tableCls.th}>{t("col.book")}</th>
                      <th className={tableCls.th}>{t("col.requested")}</th>
                      <th className={tableCls.th}>{t("col.due")}</th>
                      <th className={tableCls.th}>{t("col.status")}</th>
                      <th className={tableCls.th}><span className="sr-only">{t("col.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className={cn(tableCls.row, r.status === "OVERDUE" && "bg-danger-soft/40")}>
                        <td className={tableCls.td}>
                          <Link dir="auto" to={`/books/${r.bookId}`} className="font-medium hover:text-brand-dark hover:underline">{r.bookTitle}</Link>
                        </td>
                        <td className={cn(tableCls.td, "whitespace-nowrap")}>{fmtDate(r.requestedAt)}</td>
                        <td className={cn(tableCls.td, "whitespace-nowrap")}>{fmtDate(r.dueDate)}</td>
                        <td className={tableCls.td}><StatusBadge status={r.status} /></td>
                        <td className={cn(tableCls.td, "text-end")}><RequestDocButton record={r} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
