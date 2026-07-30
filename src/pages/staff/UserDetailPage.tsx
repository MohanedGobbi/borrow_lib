import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiUsers } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { RequestDocButton } from "@/components/RequestDocButton";
import { fmtDate } from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Staff view of one user: profile card + full borrowing history. Admin can delete. */
export default function UserDetailPage() {
  const { id } = useParams();
  const { me } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, loading, error } = useApi(() => apiUsers.get(Number(id)), [id]);

  if (loading) return <FullPageLoader />;
  if (error || !data) {
    return (
      <div className="rounded-md border border-border bg-white p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("users.noUsers")}</p>
        <Button asChild variant="link" className="mt-2 text-burnt"><Link to="/staff/users">{t("users.title")}</Link></Button>
      </div>
    );
  }

  const { member, records } = data;

  const deleteAccount = async () => {
    try {
      await apiUsers.remove(member.id);
      toast.success("Account deleted.");
      navigate("/staff/users");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="text-burnt">
        <Link to="/staff/users"><ArrowLeft className="mr-1 size-4 rtl:rotate-180" /> {t("users.title")}</Link>
      </Button>

      <div className="rounded-md bg-ink p-6 text-white">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand">{t("profile.title")}</p>
        <h1 className="mt-1 text-2xl font-bold">{member.name}</h1>
        <p className="font-mono text-xs opacity-80">
          {member.studentOrStaffId} · {member.email} · {t("profile.since")} {member.membershipStartDate}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-sm bg-white/15 px-2 py-1 font-mono text-[11px] uppercase tracking-wider">
            {member.role}
          </span>
          <span className="rounded-sm bg-white/15 px-2 py-1 font-mono text-[11px] uppercase tracking-wider">
            {member.activeLoans}/{member.maxBorrowLimit} {t("users.loans")}
          </span>
          {member.hasOverdue ? (
            <span className="rounded-sm bg-danger px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider">
              {t("users.blocked")}
            </span>
          ) : (
            <span className="rounded-sm bg-success px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider">
              {t("users.goodStanding")}
            </span>
          )}
          {member.phoneNumber && (
            <span className="rounded-sm bg-white/15 px-2 py-1 font-mono text-[11px]">{member.phoneNumber}</span>
          )}
        </div>

        {me?.role === "ADMIN" && me.id !== member.id && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="mt-4 border-danger bg-transparent text-danger hover:bg-danger hover:text-white">
                <Trash2 className="mr-1.5 size-3.5" /> {t("users.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("users.deleteConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>{member.name} · {member.email}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={deleteAccount}>
                  {t("users.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="rounded-md border border-border bg-cream p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
          {t("users.history")} · {records.length}
        </h2>
        {records.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("req.none")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {records.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-white px-3 py-2.5">
                <div className="min-w-[200px] flex-1">
                  <Link to={`/books/${r.bookId}`} className="text-sm font-semibold hover:text-burnt">{r.bookTitle}</Link>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {fmtDate(r.requestedAt)}
                    {r.dueDate ? ` · ${t("req.due")} ${fmtDate(r.dueDate)}` : ""}
                    {r.returnedAt ? ` · ✓ ${fmtDate(r.returnedAt)}` : ""}
                  </p>
                </div>
                <StatusBadge status={r.status} />
                <RequestDocButton record={r} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
