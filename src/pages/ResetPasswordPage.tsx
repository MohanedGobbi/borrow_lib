import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { apiAuth } from "@/api";
import { ApiError } from "@/api/client";
import { useI18n } from "@/i18n";
import { AuthCard } from "@/pages/LoginPage";
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
      else setError(err instanceof ApiError && err.status === 400 ? err.message : t("auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthCard>
        <div role="status" className="text-center">
          <CheckCircle2 className="mx-auto size-8 text-brand" aria-hidden />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{t("reset.done")}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{t("reset.doneSub")}</p>
          <Button asChild className="mt-6"><Link to="/login">{t("auth.signin")}</Link></Button>
        </div>
      </AuthCard>
    );
  }

  if (badLink) {
    return (
      <AuthCard>
        <div role="alert" className="text-center">
          <LinkIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{t("reset.invalid")}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{t("reset.invalidSub")}</p>
          <Button asChild className="mt-6"><Link to="/forgot-password">{t("reset.requestNew")}</Link></Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold tracking-tight">{t("reset.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("reset.sub")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
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
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("reset.saving") : t("reset.save")}
        </Button>
      </form>
    </AuthCard>
  );
}
