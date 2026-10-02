import { Link } from "react-router";
import { Inbox, Mail } from "lucide-react";
import { apiDemo } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useI18n } from "@/i18n";
import { fmtDateTime } from "@/lib/time";
import { Container } from "@/components/Layout";
import { EmptyState, ErrorState, PageHeader, Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/auth/guards";

/** Demo builds only: the demo has no mail server, so the emails the app would send are listed here. */
export default function MailboxPage() {
  const { t } = useI18n();
  const { data: mails, error, loading, refetch } = useApi(() => apiDemo.mailbox(), [], 5_000);

  if (loading && !mails) return <FullPageLoader />;

  return (
    <Container className="max-w-4xl">
      <PageHeader title={t("mailbox.title")} description={t("mailbox.sub")} />
      <div className="mt-6 space-y-4">
        {error && !mails && <ErrorState message={error} onRetry={refetch} />}
        {mails && mails.length === 0 && (
          <Panel><EmptyState icon={Inbox} title={t("mailbox.empty")} /></Panel>
        )}
        {(mails ?? []).map((m) => {
          const link = new URL(m.link);
          return (
            <Panel
              key={m.id}
              title={<span className="flex items-center gap-2"><Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden /> <span dir="auto">{m.subject}</span></span>}
              actions={<span className="tabular text-xs text-muted-foreground">{fmtDateTime(m.at)}</span>}
            >
              <p className="text-sm text-muted-foreground">
                {t("mailbox.to")} <span dir="ltr" className="font-medium text-ink">{m.to}</span>
              </p>
              <pre dir="auto" className="mt-3 whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-ink">{m.body}</pre>
              <Button asChild variant="outline" className="mt-4">
                <Link to={`${link.pathname}${link.search}`}>{t("mailbox.link")}</Link>
              </Button>
            </Panel>
          );
        })}
      </div>
    </Container>
  );
}
