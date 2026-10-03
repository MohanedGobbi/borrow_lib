import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { apiAuth } from "@/api";
import { ApiError } from "@/api/client";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [badLink, setBadLink] = useState(!uid || !token);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiAuth.resetPassword({ uid, token, password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && !err.fields.includes("password")) setBadLink(true);
      else setError(errorMessage(t, err, "auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <div role="status">
          <CheckCircle2 className="size-8 text-brand" aria-hidden />
          <h1 className="type-title mt-5 text-ink">{t("reset.done")}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{t("reset.doneSub")}</p>
          <Button asChild className="mt-6"><Link to="/login">{t("auth.signin")}</Link></Button>
        </div>
      </AuthLayout>
    );
  }

  if (badLink) {
    return (
      <AuthLayout>
        <div role="alert">
          <LinkIcon className="size-8 text-muted-foreground" aria-hidden />
          <h1 className="type-title mt-5 text-ink">{t("reset.invalid")}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{t("reset.invalidSub")}</p>
          <Button asChild className="mt-6"><Link to="/forgot-password">{t("reset.requestNew")}</Link></Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading title={t("reset.title")}>{t("reset.sub")}</AuthHeading>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("reset.new")}</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="pw-hint" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          <p id="pw-hint" className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t("reset.confirm")}</Label>
          <Input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
        </div>
        {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy ? t("reset.saving") : t("reset.save")}
        </Button>
      </form>
    </AuthLayout>
  );
}
