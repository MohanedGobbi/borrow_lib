import { Link, useParams } from "react-router";
import { UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiAuth } from "@/api";
import { ApiError } from "@/api/client";
import { qk } from "@/api/queryKeys";
import { useI18n } from "@/i18n";
import { EmptyState } from "@/components/Page";
import { MemberDesk } from "@/components/MemberDesk";
import { FullPageLoader } from "@/auth/guards";
import { Button } from "@/components/ui/button";

/** Member workstation: the target of the library card QR code and of the desk search (staff and admins only). */
export default function ScanLookupPage() {
  const { uuid } = useParams();
  const { t } = useI18n();
  const { data, isPending, error } = useQuery({
    queryKey: qk.users.scan(uuid!), queryFn: () => apiAuth.scan(uuid!), refetchInterval: 30_000,
  });

  if (isPending) return <FullPageLoader />;
  if (error || !data) {
    return (
      <EmptyState icon={UserX} title={error instanceof ApiError && error.status === 404 ? t("scan.unknown") : t("scan.failed")}>
        <Button asChild variant="outline" size="sm"><Link to="/staff">{t("scan.back")}</Link></Button>
      </EmptyState>
    );
  }

  return (
    <MemberDesk
      member={data.member}
      records={data.activeRecords}
      historyHref={`/staff/users/${data.member.id}`}
    />
  );
}
