import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Everyone signs in with the email address and password of their account. */
export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? "/catalog", { replace: true });
    } catch (err) {
      setError(errorMessage(t, err, "auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthHeading title={t("auth.signin")}>{t("auth.signinSub")}</AuthHeading>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-sm font-medium text-brand-dark hover:underline">{t("auth.forgot")}</Link>
          </div>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy ? t("auth.signing") : t("auth.signin")}
        </Button>
      </form>

      <p className="mt-6 text-[15px] text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="font-medium text-brand-dark hover:underline">{t("auth.createOne")}</Link>
      </p>
    </AuthLayout>
  );
}
