import { Link, useParams } from "react-router";
import { apiAuth } from "@/api";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/components/Countdown";
import { FullPageLoader } from "@/auth/guards";
import { Button } from "@/components/ui/button";

/** Staff-facing QR scan lookup — target of the ID-card QR code (staff/admin only). */
export default function ScanLookupPage() {
  const { uuid } = useParams();
  const { data, loading, error } = useApi(() => apiAuth.scan(uuid!), [uuid], 30_000);

  if (loading) return <FullPageLoader />;
  if (error || !data) {
    return (
      <div className="rounded-md border border-border bg-white p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {error?.toLowerCase().includes("not found")
            ? "Unknown member ID — the scanned card is invalid."
            : "Lookup failed — you may not be signed in as staff."}
        </p>
        <Button asChild variant="link" className="mt-2 text-burnt"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    );
  }

  const { member, activeRecords } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-md bg-ink p-6 text-white">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand">Scan lookup</p>
        <h1 className="mt-1 text-2xl font-bold">{member.name}</h1>
        <p className="font-mono text-xs opacity-80">
          {member.studentOrStaffId} · {member.role.toLowerCase()} · member since {member.membershipStartDate}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-sm bg-white/15 px-2 py-1 font-mono text-[11px] uppercase tracking-wider">
            loans {member.activeLoans}/{member.maxBorrowLimit}
          </span>
          {member.hasOverdue ? (
            <span className="rounded-sm bg-danger px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider">
              overdue — new requests blocked
            </span>
          ) : (
            <span className="rounded-sm bg-success px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider">
              in good standing
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {activeRecords.length === 0 && (
          <p className="rounded-md border border-border bg-white px-4 py-6 text-center text-sm text-muted-foreground">
            No active requests or loans.
          </p>
        )}
        {activeRecords.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-md border border-border bg-white px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.bookTitle}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {r.dueDate ? `due ${fmtDate(r.dueDate)}` : `requested ${fmtDate(r.requestedAt)}`} · shelf {r.bookShelf}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
