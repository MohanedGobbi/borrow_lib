import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { apiRecords } from "@/api";
import { ApiError } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { RequestDocButton } from "@/components/RequestDocButton";
import { timeAgo } from "@/components/Countdown";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";

async function act(fn: () => Promise<unknown>, ok: string, after: () => void) {
  try {
    await fn();
    toast.success(ok);
    after();
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : "Action failed.");
  }
}

export default function ApprovalsPage() {
  const { t } = useI18n();
  const { data: records, loading, refetch } = useApi(() => apiRecords.list({ status: "PENDING" }), [], 45_000);

  if (loading) return <FullPageLoader />;
  const pending = records ?? [];

  return (
    <div className="rounded-md border border-border bg-cream p-4">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-burnt">
        {t("dash.pending")} · {pending.length}
      </h2>
      {pending.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("dash.nothingPending")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-white px-3 py-2.5">
              <div className="min-w-[220px] flex-1">
                <p className="text-sm">
                  <Link to={`/staff/users/${r.userProfileId}`} className="font-semibold text-burnt hover:underline">
                    {r.userName}
                  </Link>{" "}
                  <span className="text-muted-foreground">{t("dash.wants")}</span>{" "}
                  <Link to={`/books/${r.bookId}`} className="font-semibold hover:text-burnt">{r.bookTitle}</Link>
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {r.userIdNumber} · {t("dash.submitted")} {timeAgo(r.requestedAt)}
                </p>
              </div>
              <StatusBadge status={r.status} />
              <div className="flex gap-1.5">
                <RequestDocButton record={r} />
                <Button size="sm" className="bg-success text-white hover:bg-success/90"
                  onClick={() => act(() => apiRecords.approve(r.id), "Approved — member has 48h to pick up.", refetch)}>
                  <Check className="mr-1 size-3.5" /> {t("dash.approve")}
                </Button>
                <Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger hover:text-white"
                  onClick={() => act(() => apiRecords.reject(r.id), "Request rejected.", refetch)}>
                  <X className="mr-1 size-3.5" /> {t("dash.reject")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
