import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/auth/AuthContext";
import { DEMO, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/api/client";
import { useI18n } from "@/i18n";
import { errorMessage } from "@/lib/errors";
import { BrandMark } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ROLE: Record<string, string> = {
  "priya@example.com": "role.MEMBER",
  "daniel@example.com": "role.MEMBER",
  "staff@libborrow.dev": "role.STAFF",
  "admin@libborrow.dev": "role.ADMIN",
};

export function AuthCard({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex justify-center px-4 py-12 sm:py-16">
      <div className={wide ? "w-full max-w-xl" : "w-full max-w-md"}>
        <div className="mb-6 flex justify-center"><BrandMark /></div>
        <div className="rounded-lg border bg-white p-6 shadow-[0_1px_3px_rgb(16_24_20/0.06)] sm:p-8">{children}</div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (address: string, secret: string) => {
    setBusy(true);
    setError(null);
    try {
      await login(address, secret);
      navigate(location.state?.from ?? "/catalog", { replace: true });
    } catch (err) {
      setError(errorMessage(t, err, "auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn(email.trim(), password);
  };

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold tracking-tight">{t("auth.signin")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("auth.signinSub")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate={false}>
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
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("auth.signing") : t("auth.signin")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="font-medium text-brand-dark hover:underline">{t("auth.createOne")}</Link>
      </p>

      {DEMO && (
        <div className="mt-6 border-t pt-6">
          <h2 className="text-sm font-semibold">{t("auth.demoTitle")}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => signIn(a.email, DEMO_PASSWORD)}
                  className="w-full rounded-md border px-3 py-2.5 text-start transition-colors hover:border-brand/50 hover:bg-brand-soft/60 disabled:opacity-50"
                >
                  <span className="block text-sm font-medium leading-tight">{a.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t(DEMO_ROLE[a.email] ?? "role.MEMBER")}{a.email === "daniel@example.com" ? ` · ${t("status.OVERDUE")}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("auth.demoHint", { pw: DEMO_PASSWORD })}
          </p>
        </div>
      )}
    </AuthCard>
  );
}
