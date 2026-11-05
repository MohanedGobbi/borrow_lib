import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, NotebookPen, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
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
import { UserEditDialog } from "@/components/UserEditDialog";
import { fmtDate } from "@/lib/time";
import { EmptyState, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FullPageLoader } from "@/auth/guards";
import { tableCls } from "@/lib/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPES, type AccountType, type Profile } from "@/types";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Staff view of one member: details, internal staff notes, and full borrowing history. Admins can delete or edit the account. */
export default function UserDetailPage() {
  const { id } = useParams();
  const { me } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [noteInput, setNoteInput] = useState<string | null>(null);

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

  const saved = async (profile: Profile, message: string) => {
    toast.success(message);
    setNoteInput(null);
    await qc.invalidateQueries({ queryKey: qk.users.detail(id!) });
    await invalidateUsers(qc);
    return profile;
  };

  const changeType = useMutation({
    mutationFn: (accountType: AccountType) => apiUsers.setAccountType(Number(id), accountType),
    onSuccess: (p) => saved(p, t("users.typeChanged", { type: t(`accountType.${p.accountType}`) })),
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const setActive = useMutation({
    mutationFn: (active: boolean) => apiUsers.setActive(Number(id), active),
    onSuccess: (p) => saved(p, t(p.active ? "users.reactivated" : "users.deactivated")),
    onError: (e) => {
      toast.error(errorMessage(t, e));
    },
  });

  const saveNote = useMutation({
    mutationFn: (notes: string) => apiUsers.update(Number(id), { notes }),
    onSuccess: (p) => saved(p, t("users.notesSaved")),
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
  const currentNotes = noteInput !== null ? noteInput : (member.notes ?? "");
  const canEdit = me?.role === "ADMIN" || (me?.role === "STAFF" && member.role === "MEMBER");

  const deleteAccount = () => remove.mutate(member.id);

  const details: [string, React.ReactNode][] = [
    [t("col.id"), <span dir="ltr" className="font-mono text-[14px]">{member.studentOrStaffId}</span>],
    [t("profile.email"), <span dir="ltr">{member.email}</span>],
    [t("profile.phone"), member.phoneNumber ? <span dir="ltr">{member.phoneNumber}</span> : "—"],
    [t("profile.role"), t(`accountType.${member.accountType}`)],
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
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden /> {t("users.edit")}
              </Button>
            )}
            {me?.role === "ADMIN" && me.id !== member.id && (
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
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="h-fit space-y-6">
          <Panel title={t("profile.details")} flush>
            <dl className="divide-y">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-end">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Internal staff notes: editable by both librarians and admins */}
          <Panel title={t("users.notes")} flush>
            <div className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">{t("users.notesSub")}</p>
              <Textarea
                rows={3}
                placeholder={t("users.notesPlaceholder")}
                value={currentNotes}
                onChange={(e) => setNoteInput(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={saveNote.isPending || currentNotes.trim() === (member.notes ?? "").trim()}
                  onClick={() => saveNote.mutate(currentNotes.trim())}
                >
                  <NotebookPen className="size-3.5 me-1" aria-hidden />
                  {saveNote.isPending ? t("common.saving") : t("users.saveNotes")}
                </Button>
              </div>
            </div>
          </Panel>

          {me?.role === "ADMIN" && me.id !== member.id && (
            <Panel title={t("users.manage")}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="account-type" className="text-sm font-medium">{t("auth.accountType")}</label>
                  <Select
                    value={member.accountType}
                    disabled={changeType.isPending}
                    onValueChange={(v) => changeType.mutate(v as AccountType)}
                  >
                    <SelectTrigger id="account-type" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{t(`accountType.${type}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={setActive.isPending}
                  onClick={() => setActive.mutate(!member.active)}
                >
                  {member.active
                    ? <><UserX className="size-4" aria-hidden /> {t("users.deactivate")}</>
                    : <><UserCheck className="size-4" aria-hidden /> {t("users.reactivate")}</>}
                </Button>
              </div>
            </Panel>
          )}
        </div>

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

      <UserEditDialog
        member={member}
        open={editing}
        onOpenChange={setEditing}
        onSuccess={(p) => saved(p, t("users.updated"))}
      />
    </div>
  );
}
