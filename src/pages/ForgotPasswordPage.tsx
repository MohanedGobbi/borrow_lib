import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MailCheck } from "lucide-react";
import { apiAuth } from "@/api";
import { useI18n } from "@/i18n";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiAuth.requestPasswordReset(email.trim());
      setSent(true); // the same message whether or not an account exists
    } catch {
      setError(t("forgot.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <div role="status">
          <MailCheck className="size-8 text-brand" aria-hidden />
          <h1 className="type-title mt-5 text-ink">{t("forgot.title")}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{t("forgot.sent")}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/login">{t("forgot.back")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <AuthHeading title={t("forgot.title")}>{t("forgot.sub")}</AuthHeading>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="h-12 w-full">
              {busy ? t("forgot.sending") : t("forgot.send")}
            </Button>
          </form>

          <p className="mt-6 text-[15px]">
            <Link to="/login" className="font-medium text-brand-dark hover:underline">{t("forgot.back")}</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
