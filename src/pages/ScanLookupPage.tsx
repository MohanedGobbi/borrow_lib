import { Link, useParams } from "react-router";
import { UserX } from "lucide-react";
import { apiAuth } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/time";
import { Container } from "@/components/Layout";
import { EmptyState, PageHeader, Panel } from "@/components/Page";
import { MemberStanding } from "@/components/MemberStanding";
import { FullPageLoader } from "@/auth/guards";
import { Button } from "@/components/ui/button";
import { tableCls } from "@/lib/table";

/** Staff-facing QR scan lookup — target of the library card QR code (staff/admin only). */
export default function ScanLookupPage() {
  const { uuid } = useParams();
  const { t } = useI18n();
  const { data, loading, error } = useApi(() => apiAuth.scan(uuid!), [uuid], 30_000);

  if (loading) return <FullPageLoader />;
  if (error || !data) {
    return (
      <Container>
        <EmptyState icon={UserX} title={error instanceof ApiError && error.status === 404 ? t("scan.unknown") : t("scan.failed")}>
          <Button asChild variant="outline" size="sm"><Link to="/staff">{t("scan.back")}</Link></Button>
        </EmptyState>
      </Container>
    );
  }

  const { member, activeRecords } = data;

  return (
    <Container className="max-w-4xl">
      <p className="text-sm text-muted-foreground">{t("scan.title")}</p>
      <PageHeader
        className="mt-1"
        title={member.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span dir="ltr" className="font-mono text-sm">{member.studentOrStaffId}</span>
            <span>{t(`role.${member.role}`)}</span>
            <span><span className="tabular">{member.activeLoans} / {member.maxBorrowLimit}</span> {t("col.loans").toLowerCase()}</span>
            <MemberStanding member={member} />
          </span>
        }
        actions={<Button asChild variant="outline" size="sm"><Link to={`/staff/users/${member.id}`}>{t("users.history")}</Link></Button>}
      />

      <Panel className="mt-8" title={t("scan.active")} count={activeRecords.length} flush>
        {activeRecords.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("scan.none")}</p>
        ) : (
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>{t("col.book")}</th>
                  <th className={tableCls.th}>{t("col.shelf")}</th>
                  <th className={tableCls.th}>{t("col.due")}</th>
                  <th className={tableCls.th}>{t("col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {activeRecords.map((r) => (
                  <tr key={r.id} className={tableCls.row}>
                    <td className={tableCls.td}><span className="font-medium">{r.bookTitle}</span></td>
                    <td className={tableCls.td}><span dir="ltr" className="font-mono text-[13px]">{r.bookShelf}</span></td>
                    <td className={tableCls.td}>{fmtDate(r.dueDate)}</td>
                    <td className={tableCls.td}><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Container>
  );
}
